-- 013_lockdown_rpc_and_sessions.sql
--
-- Tres cierres coordinados (hallazgos J02, J05/OG-4 y J09):
--
-- J02 — Los RPCs SECURITY DEFINER de engagement quedaban ejecutables por
-- PUBLIC: cualquier cliente con la anon key podía llamar a
-- /rest/v1/rpc/increment_plays o increment_shares para inflar contadores, y a
-- toggle_like con el user_id de otra persona. cleanup_old_game_sessions,
-- destructivo, también quedaba abierto.
--
-- J05/OG-4 — La policy game_sessions_read era `player_id = auth.uid() OR
-- player_id IS NULL OR share_token IS NOT NULL`; share_token tiene default y
-- nunca es NULL, así que la tabla entera era legible por anon/authenticated.
-- La lectura pública por share_token pasa a una función SECURITY DEFINER que
-- devuelve solo las columnas del resultado compartido. El ranking semanal
-- agrega sesiones de todos los jugadores: pasa a otra función que devuelve
-- totales por jugador ya ordenados y recortados en SQL.
--
-- J09 — checkAchievements sumaba puntos con read-modify-write; dos partidas
-- concurrentes perdían premios. La vía se cierra del todo: el premio ya no
-- lo dicta el cliente sino unlock_achievement, que verifica la condición en
-- SQL y paga el points_reward del catálogo — sin user_id ni delta del
-- llamador. Y profiles_update_own dejaba actualizar TODA la fila propia
-- (points, quizzes_played, is_admin…): UPDATE pasa a ser por columna y solo
-- quedan editables los campos del formulario de perfil.
--
-- Idempotente: create or replace, drop policy/trigger if exists y grants
-- repetibles. El código de la app funciona igual antes y después de aplicarla
-- (usa las funciones si existen y cae a la consulta anterior si aún no).

-- ============================================
-- J02: increment_plays pasa a trigger sobre el INSERT de la partida
-- ============================================

-- Una partida insertada ES una jugada: contarla en el mismo INSERT la hace
-- atómica y deja el RPC sin llamantes legítimos. No toca updated_at: la
-- migración 011 ya decide qué cuenta como cambio de contenido.
CREATE OR REPLACE FUNCTION public.increment_plays_on_session_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.quizzes
  SET plays_count = plays_count + 1
  WHERE id = NEW.quiz_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_increment_plays_on_session_insert ON public.game_sessions;
CREATE TRIGGER trg_increment_plays_on_session_insert
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_plays_on_session_insert();

-- toggle_like: misma firma y cuerpo, más la regla que faltaba — el like solo
-- puede ser del llamador. auth.uid() es NULL para service role, SQL y pg_cron
-- (uso legítimo de mantenimiento) y para anon, que además pierde EXECUTE.
CREATE OR REPLACE FUNCTION public.toggle_like(p_quiz_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  already_liked BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'toggle_like: p_user_id no coincide con auth.uid()';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.quiz_likes
    WHERE quiz_id = p_quiz_id AND user_id = p_user_id
  ) INTO already_liked;

  IF already_liked THEN
    DELETE FROM public.quiz_likes
    WHERE quiz_id = p_quiz_id AND user_id = p_user_id;
    UPDATE public.quizzes SET likes_count = likes_count - 1 WHERE id = p_quiz_id;
    RETURN FALSE;
  ELSE
    INSERT INTO public.quiz_likes (quiz_id, user_id) VALUES (p_quiz_id, p_user_id);
    UPDATE public.quizzes SET likes_count = likes_count + 1 WHERE id = p_quiz_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.increment_plays(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_shares(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_like(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_game_sessions() FROM PUBLIC, anon, authenticated;

-- Grants mínimos, explícitos:
--  - increment_plays: ya nadie lo llama (lo hace el trigger); queda para
--    service role / administración manual.
--  - increment_shares: un share es un evento auto-reportado que también
--    registran anónimos y el runtime de la app no tiene service role, así que
--    la única vía es el propio RPC. La mitigación real contra inflarlo es el
--    rate limit por IP de la acción; aquí queda fuera PUBLIC y se nombra a
--    quién pertenece.
--  - toggle_like: solo sesiones autenticadas (la acción exige login) y el
--    guard de arriba impide mover likes ajenos.
--  - cleanup_old_game_sessions: mantenimiento; service role o el owner
--    (pg_cron corre como postgres y siempre puede ejecutarla).
GRANT EXECUTE ON FUNCTION public.increment_plays(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_shares(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_like(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_game_sessions() TO service_role;

-- ============================================
-- J05/OG-4: game_sessions deja de ser legible entera
-- ============================================

-- Solo las propias. Las anónimas (player_id IS NULL) dejan de ser legibles por
-- cualquiera: la lectura pública pasa por el token opaco de abajo.
DROP POLICY IF EXISTS "game_sessions_read" ON public.game_sessions;
CREATE POLICY "game_sessions_read" ON public.game_sessions
  FOR SELECT
  USING (player_id = auth.uid());

-- Lectura por share_token: devuelve solo lo que pinta la página /result y la
-- tarjeta OG de una partida compartida. player_id queda fuera a propósito —
-- es el dato que vinculaba a cada usuario con su historial de juego.
CREATE OR REPLACE FUNCTION public.get_session_by_share_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  quiz_id UUID,
  score INTEGER,
  max_score INTEGER,
  percentage NUMERIC,
  result_id TEXT,
  result_title TEXT,
  time_taken_seconds INTEGER,
  answers JSONB,
  share_token TEXT,
  was_shared BOOLEAN,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.quiz_id, s.score, s.max_score, s.percentage, s.result_id,
           s.result_title, s.time_taken_seconds, s.answers, s.share_token,
           s.was_shared, s.completed_at
    FROM public.game_sessions s
    WHERE s.share_token = p_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_session_by_share_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_by_share_token(TEXT)
  TO anon, authenticated, service_role;

-- Totales por jugador de los últimos 7 días: es lo único que el ranking
-- semanal lee ajenos. La ventana y el orden/límite viven en SQL — el llamador
-- no elige ni el rango (no hay "desde siempre") ni cuántos líderes puede
-- esconder un recorte de PostgREST. Empate de partidas: más perfectas gana,
-- que es el mismo criterio que pointsFor (10 por partida + 25 por perfecta).
CREATE OR REPLACE FUNCTION public.get_weekly_session_totals(p_limit INTEGER)
RETURNS TABLE (player_id UUID, played INTEGER, perfect INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT s.player_id,
           COUNT(*)::INTEGER AS played,
           COUNT(*) FILTER (WHERE s.max_score > 0 AND s.score = s.max_score)::INTEGER AS perfect
    FROM public.game_sessions s
    WHERE s.completed_at >= NOW() - INTERVAL '7 days'
      AND s.player_id IS NOT NULL
    GROUP BY s.player_id
    ORDER BY 2 DESC, 3 DESC
    LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_session_totals(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_session_totals(INTEGER)
  TO anon, authenticated, service_role;

-- ============================================
-- J09: premios de logros verificados y atómicos
-- ============================================

-- Un solo paso: inserta el logro si no lo tiene y, solo si era nuevo, paga el
-- points_reward del catálogo. La condición se verifica aquí — el llamador no
-- puede ni elegir el premio ni desbloquear lo que no le corresponde:
--  - stats salen de la propia fila de profiles;
--  - perfect_score exige una partida perfecta reciente en game_sessions;
--  - ids fuera del catálogo revientan por FK.
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_achievement_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user UUID := auth.uid();
  v_quizzes_played INTEGER;
  v_quizzes_created INTEGER;
  v_ok BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RETURN FALSE;  -- anon no desbloquea (y tampoco tiene EXECUTE).
  END IF;

  SELECT quizzes_played, quizzes_created
  INTO v_quizzes_played, v_quizzes_created
  FROM public.profiles
  WHERE id = v_user;

  v_ok := CASE p_achievement_id
    WHEN 'first_quiz'     THEN v_quizzes_played >= 1
    WHEN 'quiz_addict_10' THEN v_quizzes_played >= 10
    WHEN 'creator'        THEN v_quizzes_created >= 1
    WHEN 'perfect_score'  THEN EXISTS (
      SELECT 1 FROM public.game_sessions
      WHERE player_id = v_user
        AND max_score > 0 AND score = max_score
        AND completed_at > NOW() - INTERVAL '5 minutes'
    )
    ELSE FALSE
  END;
  IF NOT v_ok THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (v_user, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;  -- Ya lo tenía (o ganó la carrera otro request): no repaga.
  END IF;

  UPDATE public.profiles
  SET points = points + COALESCE(
    (SELECT points_reward FROM public.achievements WHERE id = p_achievement_id), 0)
  WHERE id = v_user;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.unlock_achievement(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(TEXT) TO authenticated, service_role;

-- El insert directo solo para uno mismo: antes cualquiera podía sembrar
-- logros en perfiles ajenos (los premios los pagan las vías definer, que
-- saltan RLS y no dependen de esta policy).
DROP POLICY IF EXISTS "user_achievements_insert_system" ON public.user_achievements;
CREATE POLICY "user_achievements_insert_system" ON public.user_achievements
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- profiles_update_own permitía UPDATE de toda la fila propia: puntos,
-- contadores e is_admin quedaban a una llamada de distancia. Los contadores
-- y flags los escriben solo triggers/funciones definer (corren como owner);
-- al usuario le quedan los campos que realmente edita en su perfil.
--
-- Antes hay que pasar a definer los dos triggers de mantenimiento que eran
-- INVOKER: su UPDATE a profiles corría como el llamador, y sin la columna
-- publicar un quiz o seguir a alguien revotaría con permission denied.
-- Se mantiene el cuerpo del bootstrap (TG_OP explícito y updated_at al
-- publicar), que es la versión más completa; solo cambia el privilegio de
-- ejecución.
CREATE OR REPLACE FUNCTION public.increment_creator_quizzes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.creator_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.profiles
      SET quizzes_created = quizzes_created + 1,
          updated_at = NOW()
      WHERE id = NEW.creator_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.creator_id IS NOT NULL AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
      UPDATE public.profiles
      SET quizzes_created = quizzes_created + 1,
          updated_at = NOW()
      WHERE id = NEW.creator_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (username, display_name, bio, preferred_language)
  ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO service_role;
