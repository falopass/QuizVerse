-- 019_social_y_ranking.sql
--
-- Cierres seguros y compatibles hacia atrás del informe scout-social
-- (SOC-02, SOC-08, SOC-14 y la parte de SOC-15 que no depende de decisión):
--
-- SOC-02 — user_achievements solo era legible por el dueño
--   (user_achievements_read_own, 002): un visitante del perfil público
--   recibía siempre una lista vacía y la sección "Logros" nunca aparecía.
--   La tabla solo guarda logros YA desbloqueados — son parte del perfil
--   público que el producto muestra — así que la lectura se abre. El
--   INSERT sigue cerrado (user_achievements_insert_none, 014): solo
--   escribe unlock_achievement, que es DEFINER.
--
-- SOC-08 — get_weekly_session_totals filtra por completed_at sin índice:
--   el ranking semanal barría game_sessions entera. Índice parcial sobre
--   completed_at restringido a player_id IS NOT NULL, que es exactamente
--   el filtro del RPC; las partidas anónimas no entran al ranking.
--
-- SOC-14 — get_weekly_session_totals aceptaba p_limit arbitrario:
--   p_limit NULL devolvía a TODOS los jugadores de la semana. El límite
--   se clampa en SQL (1..100, default 50) — el llamador ya no elige
--   cuántos líderes puede ver. Además nace get_weekly_rank(p_user_id):
--   el puesto propio fuera del top devuelto, contando solo jugadores con
--   más partidas (o empate con más perfectas), mismo orden que el RPC de
--   totales. Solo el propio puesto: con JWT ajeno revienta, como
--   toggle_like en la 013.
--
-- SOC-15 — update_follow_counts decrementaba sin piso: un unfollow doble
--   o drift dejaba followers_count negativo. Los decrementos pasan por
--   GREATEST(0, ...) y se reconcilian los contadores actuales desde
--   user_follows (idempotente: si ya estaban bien, es un no-op).
--   La deduplicación de notificaciones de follow queda fuera a propósito:
--   la rama feat/notificaciones-v2 rehace ese subsistema.
--
-- Idempotente: create or replace / drop if exists / create index if not
-- exists / grants repetibles. La app funciona antes y después: el RPC de
-- totales mantiene firma, get_weekly_rank se usa con fallback si falta,
-- y el cambio de policy de logros solo abre lecturas que hoy devuelven [].

-- ============================================
-- SOC-02: logros desbloqueados legibles en el perfil público
-- ============================================

DROP POLICY IF EXISTS "user_achievements_read_own" ON public.user_achievements;
CREATE POLICY "user_achievements_read_public" ON public.user_achievements
  FOR SELECT
  USING (true);

COMMENT ON POLICY "user_achievements_read_public" ON public.user_achievements IS
  'Lectura pública: solo hay filas de logros desbloqueados y el perfil los muestra a cualquier visitante. La escritura sigue cerrada (user_achievements_insert_none, 014).';

-- ============================================
-- SOC-08: índice para la ventana semanal
-- ============================================

CREATE INDEX IF NOT EXISTS idx_game_sessions_completed_at
  ON public.game_sessions (completed_at)
  WHERE player_id IS NOT NULL;

-- ============================================
-- SOC-14: tope en p_limit y puesto propio semanal
-- ============================================

-- Misma firma y cuerpo que la 013; solo cambia el LIMIT, que ahora clampea:
-- NULL -> 50, <1 -> 1, >100 -> 100.
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
    -- Desempate final por player_id: sin él, dos páginas consecutivas del
    -- ranking pueden repetir u omitir jugadores empatados.
    ORDER BY 2 DESC, 3 DESC, s.player_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_session_totals(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_session_totals(INTEGER)
  TO anon, authenticated, service_role;

-- Puesto propio en la semana, para mostrarlo fuera del top. Mismo orden
-- que get_weekly_session_totals: más partidas gana; empate, más perfectas
-- y, en empate total, player_id ascendente.
-- NULL cuando el jugador no tiene partidas autenticadas en la ventana.
CREATE OR REPLACE FUNCTION public.get_weekly_rank(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_played INTEGER;
  v_perfect INTEGER;
  v_rank INTEGER;
BEGIN
  -- Solo el propio puesto. Sin JWT de usuario (auth.uid() nulo) no hay
  -- puesto propio que consultar: se rechaza también, en vez de dejar pasar
  -- un p_user_id ajeno a una sesión autenticada sin claim `sub`.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'get_weekly_rank: p_user_id no coincide con auth.uid()';
  END IF;

  SELECT COUNT(*)::INTEGER,
         COUNT(*) FILTER (WHERE s.max_score > 0 AND s.score = s.max_score)::INTEGER
    INTO v_played, v_perfect
    FROM public.game_sessions s
    WHERE s.completed_at >= NOW() - INTERVAL '7 days'
      AND s.player_id = p_user_id;

  IF v_played IS NULL OR v_played = 0 THEN
    RETURN NULL;
  END IF;

  SELECT 1 + COUNT(*)::INTEGER INTO v_rank
    FROM (
      SELECT s.player_id,
             COUNT(*) AS played,
             COUNT(*) FILTER (WHERE s.max_score > 0 AND s.score = s.max_score) AS perfect
        FROM public.game_sessions s
        WHERE s.completed_at >= NOW() - INTERVAL '7 days'
          AND s.player_id IS NOT NULL
          AND s.player_id <> p_user_id
        GROUP BY s.player_id
    ) t
    WHERE t.played > v_played
       OR (t.played = v_played AND t.perfect > v_perfect)
       OR (t.played = v_played AND t.perfect = v_perfect AND t.player_id < p_user_id);

  RETURN v_rank;
END;
$$;

-- Solo sesiones con JWT de usuario: el guard exige p_user_id = auth.uid(),
-- así que anon y service role no tienen puesto propio que pedir.
REVOKE EXECUTE ON FUNCTION public.get_weekly_rank(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_weekly_rank(UUID) TO authenticated;

-- ============================================
-- SOC-15: contadores de follows con piso y reconciliados
-- ============================================

-- Misma función que la 013 (SECURITY DEFINER es lo que permite escribir
-- profiles pese al UPDATE por columna); solo cambia el decremento, que
-- ahora no puede pasar de cero.
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Reconciliación: la fuente de verdad es user_follows. Si los contadores
-- ya estaban bien esto no mueve nada; si había drift (o filas sembradas
-- antes del trigger) quedan corregidos en la misma migración.
UPDATE public.profiles p SET
  followers_count = (SELECT COUNT(*) FROM public.user_follows f WHERE f.following_id = p.id),
  following_count = (SELECT COUNT(*) FROM public.user_follows f WHERE f.follower_id = p.id);
