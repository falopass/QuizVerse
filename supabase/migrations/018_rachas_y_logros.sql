-- 018_rachas_y_logros.sql
--
-- Cierra J08 del informe scout-juego: seis logros sembrados eran inalcanzables
-- porque faltaban los contadores que sus condiciones necesitan, y no existía
-- racha diaria, que es la palanca más directa de «volver mañana».
--
-- Qué hace, en orden:
--   1. profiles gana current_streak, longest_streak y last_played_on.
--   2. award_quiz_points (003, reescrita por la 011) calcula la racha en el
--      mismo UPDATE atómico que ya suma puntos y partidas.
--   3. get_my_played_categories() cuenta las categorías distintas jugadas: la
--      usan el logro explorer y su barra de progreso.
--   4. unlock_achievement (013) valida además week_streak, quiz_master_50 y
--      explorer. Los tres logros que dependen de métricas que no existen de
--      forma fiable (going_viral, internet_famous, social_butterfly) siguen sin
--      condición a propósito: la UI los oculta.
--   5. El guard de columnas de la 014 cubre las tres columnas nuevas, para que
--      un JWT no pueda escribirlas ni por INSERT ni por UPDATE.
--
-- Zona horaria: la racha se cuenta por día en America/Santiago. «Volver mañana»
-- es una noción local del jugador; con UTC el día cambiaría a las 21:00 en
-- Chile y una partida de esa noche ya contaría como el día siguiente. El día se
-- fija con NOW() en el trigger (no con NEW.completed_at) para que el cliente no
-- pueda fabricar fechas.
--
-- Compatibilidad hacia atrás: las columnas nacen con DEFAULT 0/NULL, así que
-- ningún perfil existente cambia de comportamiento; la app lee las columnas
-- nuevas y cae a los contadores anteriores si aún no se aplicó la migración.
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE y DROP IF EXISTS.
--
-- Orden de aplicación: 013 -> 014 -> 018. La 018 reescribe dos funciones de la
-- 013/014 (unlock_achievement y guard_profile_editable_columns): aplicarla
-- antes dejaría la validación vieja y el guard sin las columnas nuevas.

-- ============================================
-- 1. Columnas de racha en profiles
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_played_on DATE;

COMMENT ON COLUMN public.profiles.current_streak IS
  'Días seguidos con al menos una partida propia, en zona America/Santiago. Lo escribe award_quiz_points.';
COMMENT ON COLUMN public.profiles.longest_streak IS
  'Máximo histórico de current_streak. Lo escribe award_quiz_points.';
COMMENT ON COLUMN public.profiles.last_played_on IS
  'Último día (America/Santiago) con partida propia; NULL si nunca jugó. Lo escribe award_quiz_points.';

-- ============================================
-- 2. award_quiz_points: puntos, partidas y racha en un solo UPDATE
-- ============================================

-- Un único UPDATE: la racha se lee y se escribe con la misma sentencia, así que
-- dos partidas simultáneas se serializan en el lock de la fila y ninguna pisa a
-- la otra (en READ COMMITTED la expresión se reevalúa sobre la fila ya
-- actualizada). Mismo contrato de puntos que antes: 10 por partida y 25 extra
-- por partida perfecta.
CREATE OR REPLACE FUNCTION public.award_quiz_points()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER := 10;
  v_today DATE := (NOW() AT TIME ZONE 'America/Santiago')::DATE;
BEGIN
  IF NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.max_score > 0 AND NEW.score = NEW.max_score THEN
    points_earned := points_earned + 25;
  END IF;

  UPDATE public.profiles
  SET points = points + points_earned,
      quizzes_played = quizzes_played + 1,
      current_streak = CASE
        -- Primera partida de la vida.
        WHEN last_played_on IS NULL THEN 1
        -- Ya jugó hoy (o la fecha quedó adelantada): no suma dos veces.
        WHEN last_played_on >= v_today THEN current_streak
        -- Ayer: la racha sigue.
        WHEN last_played_on = v_today - 1 THEN current_streak + 1
        -- Hueco de uno o más días: vuelve a empezar en 1.
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_award_quiz_points ON public.game_sessions;
CREATE TRIGGER trigger_award_quiz_points
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  WHEN (NEW.player_id IS NOT NULL)
  EXECUTE FUNCTION public.award_quiz_points();

-- ============================================
-- 3. Categorías distintas jugadas (logro explorer y su progreso)
-- ============================================

-- Sin parámetro a propósito: solo el propio jugador. Devuelve 0 para anon.
-- La usan la app (barra de progreso) y unlock_achievement (condición), así que
-- el número que ve el jugador y el que decide el premio son el mismo.
CREATE OR REPLACE FUNCTION public.get_my_played_categories()
RETURNS INTEGER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(DISTINCT q.category_id)
  INTO v_count
  FROM public.game_sessions s
  JOIN public.quizzes q ON q.id = s.quiz_id
  WHERE s.player_id = v_user
    AND q.category_id IS NOT NULL;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_my_played_categories() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_played_categories() TO authenticated, service_role;

-- ============================================
-- 4. unlock_achievement: tres condiciones nuevas
-- ============================================

-- Se mantiene el contrato de la 013: la condición se verifica aquí, el llamador
-- no elige premio ni usuario, y solo paga si el logro era nuevo.
--
-- Umbrales: 7 días, 50 partidas y 5 categorías — los mismos condition_value que
-- el catálogo sembrado (quizverse-bootstrap.sql). Si cambian ahí, cambian aquí.
--
-- week_streak mira GREATEST(current_streak, longest_streak): la racha de 7 pudo
-- completarse antes de aplicar esta migración o antes de que el desbloqueo
-- llegara a correr, y el logro no debe perderse por eso.
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_achievement_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user UUID := auth.uid();
  v_quizzes_played INTEGER;
  v_quizzes_created INTEGER;
  v_longest_streak INTEGER;
  v_current_streak INTEGER;
  v_ok BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RETURN FALSE;  -- anon no desbloquea (y tampoco tiene EXECUTE).
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
      SELECT 1 FROM public.game_sessions
      WHERE player_id = v_user
        AND max_score > 0 AND score = max_score
        AND completed_at > NOW() - INTERVAL '5 minutes'
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

-- ============================================
-- 5. Guard de columnas: la racha tampoco la escribe el jugador
-- ============================================

-- La 013 ya revocó el UPDATE de profiles y dejó por columna solo username,
-- display_name, bio y preferred_language: las tres columnas nuevas no son
-- escribibles por JWT. Este guard es la segunda capa (la misma que protege
-- points o is_admin) y cubre también el INSERT propio.
CREATE OR REPLACE FUNCTION public.guard_profile_editable_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role, seeds, migraciones y funciones/triggers internos DEFINER
  -- (award_quiz_points, update_follow_counts, unlock_achievement,
  -- handle_new_user) pasan libres: no son escrituras directas del usuario.
  IF auth.uid() IS NULL OR current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Un perfil creado por JWT solo puede nacer con los defaults.
    NEW.points := 0;
    NEW.quizzes_played := 0;
    NEW.quizzes_created := 0;
    NEW.is_admin := false;
    NEW.is_verified := false;
    NEW.followers_count := 0;
    NEW.following_count := 0;
    NEW.current_streak := 0;
    NEW.longest_streak := 0;
    NEW.last_played_on := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE por JWT: identidad, economia y flags editoriales no se negocian.
  NEW.id := OLD.id;
  NEW.points := OLD.points;
  NEW.quizzes_played := OLD.quizzes_played;
  NEW.quizzes_created := OLD.quizzes_created;
  NEW.is_admin := OLD.is_admin;
  NEW.is_verified := OLD.is_verified;
  NEW.followers_count := OLD.followers_count;
  NEW.following_count := OLD.following_count;
  NEW.current_streak := OLD.current_streak;
  NEW.longest_streak := OLD.longest_streak;
  NEW.last_played_on := OLD.last_played_on;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := OLD.updated_at;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_editable_columns() IS
  'Restaura columnas no editables de profiles en escrituras con JWT (anon/authenticated): puntos, contadores, racha, is_admin, is_verified. Service role y triggers DEFINER pasan libres.';

DROP TRIGGER IF EXISTS trigger_guard_profile_editable_columns ON public.profiles;
CREATE TRIGGER trigger_guard_profile_editable_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_editable_columns();
