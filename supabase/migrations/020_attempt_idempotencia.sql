-- 020_attempt_idempotencia.sql
--
-- J06 — El envío de una partida no era idempotente: cada llamada insertaba
-- una fila nueva en game_sessions y el trigger award_quiz_points volvía a
-- pagar. Un doble clic, un retry de la server action o una llamada directa
-- duplicaban sesión, plays y puntos.
--
-- Cambio:
--   * game_sessions.attempt_id: id de la partida efímera que emite
--     startQuizAttempt (token HMAC). NULL en filas anteriores a esta
--     migración y en clientes viejos, que siguen enviando sin attempt.
--   * Índice único parcial: un attempt guarda como máximo una sesión. El
--     código detecta la columna ausente (PGRST204/42703) y sigue guardando
--     como antes, así que esta migración puede aplicarse después del deploy.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS attempt_id UUID;

COMMENT ON COLUMN public.game_sessions.attempt_id IS
  'Partida efímera firmada (startQuizAttempt). Única por sesión; NULL en filas anteriores a la 020.';

CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_attempt_id_unique
  ON public.game_sessions (attempt_id)
  WHERE attempt_id IS NOT NULL;
