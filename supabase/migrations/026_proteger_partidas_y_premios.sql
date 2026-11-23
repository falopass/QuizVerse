-- 026_proteger_partidas_y_premios.sql
--
-- Cierre de los hallazgos A-01 (integridad de escritura de partidas y puntos),
-- A-09 (coherencia de marcador, participación, personalidad vs trivia) y
-- A-16 (revocación de ejecución directa de shares tras desplegar el escritor L3):
--
-- Problema:
--   * `game_sessions` permitía INSERT directo desde `anon` y `authenticated`
--     por PostgREST (`014_endurecer_rls.sql`), disparando `award_quiz_points`
--     e `increment_plays_on_session_insert` sobre datos enviados fuera de
--     `submitQuizResult`.
--   * `award_quiz_points` y `unlock_achievement('perfect_score')` (`018`)
--     otorgaban puntos por envíos con cero participación y trataban la
--     completitud de `personality` (`score = max_score`) como partida perfecta
--     de trivia (+25 puntos e insignia `perfect_score`).
--   * `increment_shares` y `mark_session_shared` seguían abiertos a `anon` y
--     `authenticated` mientras L3 trasladaba las acciones al escritor de
--     servidor (`service_role`).
--
-- Solución:
--   1. `public.game_sessions`: cierra INSERT/UPDATE/DELETE directos para
--      `anon`/`authenticated` (`game_sessions_insert_none` + REVOKE), dejando
--      la escritura exclusivamente en `submitQuizResult` (`service_role`) y
--      conservando SELECT propio para `authenticated` y lectura por token vía
--      `get_session_by_share_token`.
--   2. `public.guard_game_session_ranges()`: exige además que el quiz exista y
--      esté `published`, `max_score > 0` y `time_taken_seconds <= 7200`.
--   3. `public.game_session_has_participation(JSONB, INTEGER)`: comprueba que
--      la sesión tenga al menos una respuesta con `selected_option_id` no vacío
--      (o `score > 0` en filas históricas sin detalle).
--   4. `public.award_quiz_points()` y `public.unlock_achievement(TEXT)`:
--      no acreditan puntos ni racha si no hubo participación, y reservan el
--      bono de perfección (+25) y el logro `perfect_score` exclusivamente a
--      quizzes con `quiz_type = 'trivia'`.
--   5. `public.increment_shares(UUID)` y `public.mark_session_shared(TEXT)`:
--      revocan EXECUTE a `anon`/`authenticated`, reservándolo a `service_role`.
--
-- Precondición de despliegue:
--   * Desplegar primero el código de L3 (`submitQuizResult`, `incrementShares`,
--     `markSessionShared` con `createServiceClient()`) y confirmar que
--     `SUPABASE_SERVICE_ROLE_KEY` está activo en el Worker antes de aplicar.

-- ============================================
-- 1. game_sessions: escritura exclusiva del servidor (service_role)
-- ============================================

DROP POLICY IF EXISTS "game_sessions_insert_any" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_insert_player" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_insert_none" ON public.game_sessions;

CREATE POLICY "game_sessions_insert_none" ON public.game_sessions
  FOR INSERT
  WITH CHECK (false);

COMMENT ON POLICY "game_sessions_insert_none" ON public.game_sessions IS
  'Sin inserts directos desde PostgREST: submitQuizResult califica con la clave privada y persiste con service_role.';

REVOKE INSERT, UPDATE, DELETE ON public.game_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO service_role;

-- ============================================
-- 2. Guard de rangos y quiz publicado en game_sessions
-- ============================================

CREATE OR REPLACE FUNCTION public.guard_game_session_ranges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.score < 0
     OR NEW.max_score <= 0
     OR NEW.score > NEW.max_score
     OR COALESCE(NEW.time_taken_seconds, 0) < 0
     OR COALESCE(NEW.time_taken_seconds, 0) > 7200
  THEN
    RAISE EXCEPTION 'Resultado de partida fuera de rango'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = NEW.quiz_id
      AND q.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Solo se pueden registrar partidas sobre quizzes publicados'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_game_session_ranges() IS
  'Valida rangos de score/max_score/tiempo y exige que el quiz objetivo esté publicado antes de insertar en game_sessions.';

DROP TRIGGER IF EXISTS trigger_guard_game_session_ranges ON public.game_sessions;
CREATE TRIGGER trigger_guard_game_session_ranges
  BEFORE INSERT ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_game_session_ranges();

-- ============================================
-- 3. Participación efectiva y separación personalidad vs trivia
-- ============================================

CREATE OR REPLACE FUNCTION public.game_session_has_participation(
  p_answers JSONB,
  p_score INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(p_score, 0) > 0
      OR (
        jsonb_typeof(p_answers) = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_answers) AS a
          WHERE jsonb_typeof(a.value) = 'object'
            AND COALESCE(btrim(a.value ->> 'selected_option_id'), '') <> ''
        )
      );
$$;

COMMENT ON FUNCTION public.game_session_has_participation(JSONB, INTEGER) IS
  'True cuando la partida registra al menos una opción elegida no vacía (o score > 0 en filas históricas).';

CREATE OR REPLACE FUNCTION public.award_quiz_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  points_earned INTEGER := 10;
  v_today DATE := (NOW() AT TIME ZONE 'America/Santiago')::DATE;
  v_quiz_type public.quiz_type;
BEGIN
  IF NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sin participación real (todas las preguntas omitidas) no hay puntos ni racha.
  IF NOT public.game_session_has_participation(NEW.answers, NEW.score) THEN
    RETURN NEW;
  END IF;

  SELECT q.quiz_type INTO v_quiz_type
  FROM public.quizzes q
  WHERE q.id = NEW.quiz_id;

  -- La perfección (+25) es exclusiva de trivia; en personality completar es el pase base (10).
  IF v_quiz_type = 'trivia' AND NEW.max_score > 0 AND NEW.score = NEW.max_score THEN
    points_earned := points_earned + 25;
  END IF;

  UPDATE public.profiles
  SET points = points + points_earned,
      quizzes_played = quizzes_played + 1,
      current_streak = CASE
        WHEN last_played_on IS NULL THEN 1
        WHEN last_played_on >= v_today THEN current_streak
        WHEN last_played_on = v_today - 1 THEN current_streak + 1
        ELSE 1
      END,
      longest_streak = GREATEST(
        longest_streak,
        CASE
          WHEN last_played_on IS NULL THEN 1
          WHEN last_played_on >= v_today THEN current_streak
          WHEN last_played_on = v_today - 1 THEN current_streak + 1
          ELSE 1
        END
      ),
      last_played_on = v_today,
      updated_at = NOW()
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.award_quiz_points() IS
  'Acredita puntos (10 base con participación; +25 extra solo en trivia perfecta), partidas y racha diaria en America/Santiago.';

DROP TRIGGER IF EXISTS trigger_award_quiz_points ON public.game_sessions;
CREATE TRIGGER trigger_award_quiz_points
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  WHEN (NEW.player_id IS NOT NULL)
  EXECUTE FUNCTION public.award_quiz_points();

CREATE OR REPLACE FUNCTION public.unlock_achievement(p_achievement_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_quizzes_played INTEGER;
  v_quizzes_created INTEGER;
  v_longest_streak INTEGER;
  v_current_streak INTEGER;
  v_ok BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT quizzes_played, quizzes_created, longest_streak, current_streak
  INTO v_quizzes_played, v_quizzes_created, v_longest_streak, v_current_streak
  FROM public.profiles
  WHERE id = v_user;

  v_ok := CASE p_achievement_id
    WHEN 'first_quiz'     THEN v_quizzes_played >= 1
    WHEN 'quiz_addict_10' THEN v_quizzes_played >= 10
    WHEN 'quiz_master_50' THEN v_quizzes_played >= 50
    WHEN 'creator'        THEN v_quizzes_created >= 1
    WHEN 'perfect_score'  THEN EXISTS (
      SELECT 1
      FROM public.game_sessions s
      JOIN public.quizzes q ON q.id = s.quiz_id
      WHERE s.player_id = v_user
        AND q.quiz_type = 'trivia'
        AND s.max_score > 0
        AND s.score = s.max_score
        AND public.game_session_has_participation(s.answers, s.score)
        AND s.completed_at > NOW() - INTERVAL '5 minutes'
    )
    WHEN 'week_streak'    THEN GREATEST(v_longest_streak, v_current_streak) >= 7
    WHEN 'explorer'       THEN public.get_my_played_categories() >= 5
    ELSE FALSE
  END;
  IF NOT v_ok THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (v_user, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET points = points + COALESCE(
    (SELECT points_reward FROM public.achievements WHERE id = p_achievement_id), 0)
  WHERE id = v_user;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unlock_achievement(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(TEXT) TO authenticated, service_role;

-- ============================================
-- 4. Shares: escritura exclusiva del servidor tras el limiter (A-16)
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_session_shared(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.game_sessions s
  SET was_shared = TRUE
  FROM public.quizzes q
  WHERE s.share_token = p_token
    AND s.was_shared = FALSE
    AND q.id = s.quiz_id
    AND q.status = 'published';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_shares(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_shares(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_session_shared(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_session_shared(TEXT) TO service_role;
