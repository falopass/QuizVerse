-- 021_ranking_grupo.sql
--
-- Ranking de grupo por enlace («Grupo de Diego: Camila 8/8, tú 7/8»): un solo
-- link público junta a todos los que juegan desde él, sin cuenta, con un
-- apodo moderado. Reemplaza en producto al reto 1 a 1 (?challenge=), que
-- sigue funcionando para los enlaces ya enviados.
--
-- Modelo:
--   * quiz_groups: un quiz + un creador (sesión de partida y/o usuario) +
--     token público aleatorio de 20 hex (gen_random_bytes(10)). El largo es
--     distinto al share_token de sesión (16 hex) para que ningún token de
--     sesión resuelva un grupo ni viceversa.
--   * quiz_group_entries: apodo normalizado + puntaje/máximo/tiempo copiados
--     de la game_session ya puntuada por el servidor (scoreSubmission), con
--     game_session_id único por grupo: una partida entra una sola vez.
--
-- Diseño de acceso (RLS):
--   * Ambas tablas tienen RLS activo y NINGUNA policy: ni lectura ni
--     escritura directa para anon/authenticated. El listado de grupos no
--     existe como operación.
--   * La lectura pública del ranking pasa por dos funciones SECURITY
--     DEFINER que resuelven únicamente por token opaco y devuelven solo
--     campos públicos (apodo, puntaje, tiempo). No hay función por id ni
--     por creador: sin token no hay ranking.
--   * Las escrituras las hace la server action con service role tras
--     validar (formato de token, apodo moderado, sesión del mismo quiz,
--     rate limit por IP): el service role bypassea RLS.
--   * Único dato visible de una persona: su apodo. game_session_id se
--     devuelve solo para que el cliente resalte su propia fila; no
--     expone más datos que el ranking mismo.
--
-- Reuso: un creador con cuenta comparte siempre el mismo grupo por quiz
--   (índice único parcial por quiz_id+creator_user_id); un creador
--   anónimo, el del quiz+sesión que lo originó (quiz_id+creator_session_id
--   cuando no hay usuario), así "Reta a un amigo" no crea duplicados.
--
-- Idempotente: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS /
-- GRANT/REVOKE repetibles. Hasta que esta migración se aplique, la app
-- degrada: la capa de datos detecta tabla/función ausente y muestra
-- "ranking no disponible" sin romper el resultado.

-- ============================================
-- Tablas
-- ============================================

CREATE TABLE IF NOT EXISTS public.quiz_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  creator_session_id UUID REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  creator_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_nickname TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(10), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT quiz_groups_token_unique UNIQUE (token),
  CONSTRAINT quiz_groups_creator_chk CHECK (
    creator_session_id IS NOT NULL OR creator_user_id IS NOT NULL
  )
);

COMMENT ON TABLE public.quiz_groups IS
  'Grupo de ranking compartido por enlace. Token público opaco de 20 hex; el creador es la sesión/usuario que compartió.';

COMMENT ON COLUMN public.quiz_groups.creator_nickname IS
  'Apodo visible del creador, ya normalizado y validado por el filtro de apodos. Único dato público del creador.';

-- Un grupo por quiz y creador con cuenta (reutiliza el link al volver a retar).
CREATE UNIQUE INDEX IF NOT EXISTS quiz_groups_creator_user_unique
  ON public.quiz_groups (quiz_id, creator_user_id)
  WHERE creator_user_id IS NOT NULL;

-- Un grupo por quiz y sesión creadora anónima.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_groups_creator_session_unique
  ON public.quiz_groups (quiz_id, creator_session_id)
  WHERE creator_user_id IS NULL AND creator_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quiz_groups_token_idx ON public.quiz_groups (token);

CREATE TABLE IF NOT EXISTS public.quiz_group_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.quiz_groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  time_taken_seconds INTEGER,
  game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT quiz_group_entries_session_unique UNIQUE (group_id, game_session_id)
);

COMMENT ON TABLE public.quiz_group_entries IS
  'Entrada del ranking de un grupo. score/max_score/tiempo se copian de game_sessions (puntaje server-authoritative); una sesión entra una vez por grupo.';

CREATE INDEX IF NOT EXISTS quiz_group_entries_group_idx
  ON public.quiz_group_entries (group_id, score DESC);

-- ============================================
-- RLS: todo cerrado; la lectura pública pasa por el RPC por token
-- ============================================

ALTER TABLE public.quiz_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_group_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Lectura pública por token
-- ============================================

-- Datos del grupo que la UI necesita para el aviso "Estás jugando el ranking
-- de {apodo} (n jugadores)": apodo del creador y conteo, sin PII.
CREATE OR REPLACE FUNCTION public.get_quiz_group_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  quiz_id UUID,
  creator_nickname TEXT,
  entries_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.quiz_id, g.creator_nickname,
         (SELECT COUNT(*)::INTEGER FROM public.quiz_group_entries e WHERE e.group_id = g.id),
         g.created_at
  FROM public.quiz_groups g
  WHERE g.token = p_token;
END;
$$;

-- Entradas del ranking en su orden (puntaje desc, tiempo asc, llegada asc);
-- top 100: el enlace va a un grupo de WhatsApp, no a un directorio público.
-- p_session (opcional, sin auth) incluye la fila propia aunque quede fuera
-- del top: el cliente resalta su marca y no finge "no entraste".
DROP FUNCTION IF EXISTS public.get_quiz_group_entries(TEXT);
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
  position INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT e.nickname, e.score, e.max_score, e.time_taken_seconds,
           e.game_session_id, e.created_at,
           ROW_NUMBER() OVER (
             ORDER BY e.score DESC,
                      e.time_taken_seconds ASC NULLS LAST,
                      e.created_at ASC
           ) AS pos
    FROM public.quiz_group_entries e
    JOIN public.quiz_groups g ON g.id = e.group_id
    WHERE g.token = p_token
  )
  SELECT r.nickname, r.score, r.max_score, r.time_taken_seconds,
         r.game_session_id, r.created_at, r.pos::INTEGER
  FROM ranked r
  WHERE r.pos <= 100
     OR (p_session IS NOT NULL AND r.game_session_id = p_session)
  ORDER BY r.pos;
END;
$$;

-- El token es la única llave pública de lectura; anon y authenticated pueden
-- ejecutar estas funciones porque su resultado se limita al grupo del token.
REVOKE EXECUTE ON FUNCTION public.get_quiz_group_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_group_by_token(TEXT)
  TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_quiz_group_entries(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_group_entries(TEXT, UUID)
  TO anon, authenticated, service_role;
