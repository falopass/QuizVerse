-- 027_ordenar_ranking_grupos.sql
--
-- Cierre del hallazgo A-10 (ranking de grupo, mejor intento elegible por
-- participante y desempate determinista):
--
-- Problema:
--   * `quiz_group_entries` (`021_ranking_grupo.sql`) solo imponía unicidad por
--     `(group_id, game_session_id)`: un mismo participante autenticado podía
--     inscribir múltiples partidas propias en el mismo grupo y ocupar varias
--     posiciones de la tabla.
--   * El orden `ORDER BY e.score DESC, e.time_taken_seconds ASC NULLS LAST,
--     e.created_at ASC` carecía de desempate determinista final cuando dos
--     entradas empataban en puntaje, tiempo y marca temporal.
--
-- Solución:
--   1. Añade `player_id` a `public.quiz_group_entries`, hace backfill desde
--      `public.game_sessions` y consolida duplicados históricos por
--      `(group_id, player_id)` conservando únicamente el mejor intento
--      (`score DESC, time_taken_seconds ASC NULLS LAST, created_at ASC,
--      game_session_id ASC, id ASC`).
--   2. Crea índice único parcial `quiz_group_entries_player_unique` sobre
--      `(group_id, player_id) WHERE player_id IS NOT NULL` e índice de orden
--      `quiz_group_entries_order_idx`.
--   3. Instala `trigger_sync_quiz_group_entry` (`public.sync_quiz_group_entry()`):
--      sincroniza `score`, `max_score`, `time_taken_seconds` y `player_id`
--      directamente desde la `game_session` autoritativa y valida que pertenezca
--      al quiz del grupo.
--   4. Actualiza `public.get_quiz_group_by_token(TEXT)` y
--      `public.get_quiz_group_entries(TEXT, UUID)` para presentar un único
--      mejor intento elegible por participante con desempate estable.

-- ============================================
-- 1. Columna player_id, backfill y consolidación al mejor intento
-- ============================================

ALTER TABLE public.quiz_group_entries
  ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quiz_group_entries.player_id IS
  'Participante autenticado dueño de la partida (copiado de game_sessions.player_id); NULL en entradas anónimas.';

UPDATE public.quiz_group_entries e
SET player_id = s.player_id
FROM public.game_sessions s
WHERE s.id = e.game_session_id
  AND e.player_id IS NULL
  AND s.player_id IS NOT NULL;

WITH ranked_participant_entries AS (
  SELECT e.id,
         ROW_NUMBER() OVER (
           PARTITION BY e.group_id, e.player_id
           ORDER BY e.score DESC,
                    e.time_taken_seconds ASC NULLS LAST,
                    e.created_at ASC,
                    e.game_session_id ASC,
                    e.id ASC
         ) AS rn
  FROM public.quiz_group_entries e
  WHERE e.player_id IS NOT NULL
)
DELETE FROM public.quiz_group_entries e
USING ranked_participant_entries r
WHERE e.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_group_entries_player_unique
  ON public.quiz_group_entries (group_id, player_id)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quiz_group_entries_order_idx
  ON public.quiz_group_entries (
    group_id,
    score DESC,
    time_taken_seconds ASC NULLS LAST,
    created_at ASC,
    game_session_id ASC
  );

-- ============================================
-- 2. Trigger autoritativo de sincronización desde game_sessions
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_quiz_group_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group_quiz_id UUID;
  v_session_quiz_id UUID;
  v_player_id UUID;
  v_score INTEGER;
  v_max_score INTEGER;
  v_time_taken INTEGER;
BEGIN
  SELECT g.quiz_id INTO v_group_quiz_id
  FROM public.quiz_groups g
  WHERE g.id = NEW.group_id;

  IF v_group_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Grupo de ranking inexistente'
      USING ERRCODE = '23503';
  END IF;

  SELECT s.quiz_id, s.player_id, s.score, s.max_score, s.time_taken_seconds
  INTO v_session_quiz_id, v_player_id, v_score, v_max_score, v_time_taken
  FROM public.game_sessions s
  WHERE s.id = NEW.game_session_id;

  IF v_session_quiz_id IS NULL OR v_session_quiz_id IS DISTINCT FROM v_group_quiz_id THEN
    RAISE EXCEPTION 'La sesión no pertenece al quiz del grupo'
      USING ERRCODE = '23514';
  END IF;

  IF v_max_score <= 0 OR v_score < 0 OR v_score > v_max_score OR COALESCE(v_time_taken, 0) < 0 THEN
    RAISE EXCEPTION 'La sesión no es elegible para el ranking de grupo'
      USING ERRCODE = '23514';
  END IF;

  NEW.player_id := v_player_id;
  NEW.score := v_score;
  NEW.max_score := v_max_score;
  NEW.time_taken_seconds := v_time_taken;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_quiz_group_entry() IS
  'Fuerza que score, max_score, time_taken_seconds y player_id de quiz_group_entries provengan siempre de game_sessions.';

REVOKE EXECUTE ON FUNCTION public.sync_quiz_group_entry() FROM PUBLIC;

DROP TRIGGER IF EXISTS trigger_sync_quiz_group_entry ON public.quiz_group_entries;
CREATE TRIGGER trigger_sync_quiz_group_entry
  BEFORE INSERT OR UPDATE ON public.quiz_group_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quiz_group_entry();

-- ============================================
-- 3. Lectura pública: mejor intento por participante y desempate estable
-- ============================================

CREATE OR REPLACE FUNCTION public.get_quiz_group_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  quiz_id UUID,
  creator_nickname TEXT,
  entries_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id,
         g.quiz_id,
         g.creator_nickname,
         (
           SELECT COUNT(DISTINCT COALESCE(COALESCE(e.player_id, s.player_id)::text, 'anon:' || e.game_session_id::text))::INTEGER
           FROM public.quiz_group_entries e
           LEFT JOIN public.game_sessions s ON s.id = e.game_session_id
           WHERE e.group_id = g.id
         ),
         g.created_at
  FROM public.quiz_groups g
  WHERE g.token = p_token;
END;
$$;

DROP FUNCTION IF EXISTS public.get_quiz_group_entries(TEXT);
DROP FUNCTION IF EXISTS public.get_quiz_group_entries(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_quiz_group_entries(
  p_token TEXT,
  p_session UUID DEFAULT NULL
)
RETURNS TABLE (
  nickname TEXT,
  score INTEGER,
  max_score INTEGER,
  time_taken_seconds INTEGER,
  game_session_id UUID,
  created_at TIMESTAMPTZ,
  "position" INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_player_id UUID;
BEGIN
  IF p_session IS NOT NULL THEN
    SELECT s.player_id INTO v_caller_player_id
    FROM public.game_sessions s
    WHERE s.id = p_session;
  END IF;

  RETURN QUERY
  WITH best_per_participant AS (
    SELECT DISTINCT ON (COALESCE(COALESCE(e.player_id, s.player_id)::text, 'anon:' || e.game_session_id::text))
           e.id,
           e.nickname,
           e.score,
           e.max_score,
           e.time_taken_seconds,
           e.game_session_id,
           e.created_at,
           COALESCE(e.player_id, s.player_id) AS effective_player_id
    FROM public.quiz_group_entries e
    JOIN public.quiz_groups g ON g.id = e.group_id
    LEFT JOIN public.game_sessions s ON s.id = e.game_session_id
    WHERE g.token = p_token
    ORDER BY COALESCE(COALESCE(e.player_id, s.player_id)::text, 'anon:' || e.game_session_id::text),
             e.score DESC,
             e.time_taken_seconds ASC NULLS LAST,
             e.created_at ASC,
             e.game_session_id ASC,
             e.id ASC
  ),
  ranked AS (
    SELECT b.nickname,
           b.score,
           b.max_score,
           b.time_taken_seconds,
           b.game_session_id,
           b.created_at,
           b.effective_player_id,
           ROW_NUMBER() OVER (
             ORDER BY b.score DESC,
                      b.time_taken_seconds ASC NULLS LAST,
                      b.created_at ASC,
                      b.game_session_id ASC,
                      b.id ASC
           ) AS pos
    FROM best_per_participant b
  )
  SELECT r.nickname,
         r.score,
         r.max_score,
         r.time_taken_seconds,
         r.game_session_id,
         r.created_at,
         r.pos::INTEGER
  FROM ranked r
  WHERE r.pos <= 100
     OR (p_session IS NOT NULL AND r.game_session_id = p_session)
     OR (v_caller_player_id IS NOT NULL AND r.effective_player_id = v_caller_player_id)
  ORDER BY r.pos;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_quiz_group_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_group_by_token(TEXT)
  TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_quiz_group_entries(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_group_entries(TEXT, UUID)
  TO anon, authenticated, service_role;
