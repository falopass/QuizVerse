-- 018_marcar_sesion_compartida.sql
--
-- J12 — `game_sessions.was_shared` existe desde la 001 pero nadie la escribía:
-- `incrementShares` sube `quizzes.shares_count` y no conoce la sesión. La
-- partida compartida se marca ahora con este RPC, llamado desde la server
-- action `markSessionShared` (token validado y rate limit por IP).
--
-- No hay policy de UPDATE sobre game_sessions (014), así que la escritura va
-- por una función SECURITY DEFINER que solo toca la fila del token. Un token
-- desconocido no actualiza nada y no delata si existe: la acción responde
-- igual en ambos casos.
--
-- Idempotente: create or replace y grants repetibles.

CREATE OR REPLACE FUNCTION public.mark_session_shared(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.game_sessions
  SET was_shared = TRUE
  WHERE share_token = p_token
    AND was_shared = FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_session_shared(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_session_shared(TEXT)
  TO anon, authenticated, service_role;
