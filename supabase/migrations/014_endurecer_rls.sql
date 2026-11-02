-- 014 — Endurecer RLS: partidas, perfiles, quizzes y logros
--
-- Cierra cuatro agujeros verificados por PostgREST (informe scout-auth-backend,
-- AB-02/AB-03/AB-08/AB-09):
--
--   * game_sessions_insert_any (002) tenia WITH CHECK (true): cualquier rol,
--     incluido anon, insertaba partidas con player_id ajeno. El trigger
--     award_quiz_points sumaba puntos a la victima y update_quiz_avg_score
--     corrompia la media del quiz (en produccion hay filas basura, p.ej.
--     time_ms negativos, que entraron sin pasar por el Zod de la app).
--   * profiles_update_own solo exige auth.uid() = id: PATCH con el propio JWT
--     editaba points, quizzes_played/created, followers_count e is_verified
--     (is_admin ya lo cubre el guard de la migracion 010).
--   * quizzes_update_own solo exige creator_id: el creador podia inflar
--     plays_count/likes_count/avg_score, auto-otorgarse is_featured y mover
--     status fuera del flujo de moderacion.
--   * user_achievements_insert_system (CHECK true) dejaba insertar logros con
--     user_id ajeno.
--
-- RLS no puede restringir columnas, asi que el patron es el de la migracion
-- 010: triggers BEFORE que restauran lo que el usuario no puede tocar.
--
-- El discriminante NO es auth.uid(): un trigger SECURITY DEFINER corre con el
-- JWT de la request original, asi que una escritura interna (award_quiz_points
-- sumando puntos tras una partida) tambien ve el uid del jugador. Lo que SI
-- cambia es el rol del statement:
--
--   * PostgREST con JWT de usuario      -> current_user = 'authenticated'
--     (o 'anon' si alguna vez escribiera con la publishable key).
--   * Triggers internos DEFINER, service role, seeds, migraciones y acciones
--     FK (ON DELETE SET NULL / CASCADE, que corren como el dueno de la tabla)
--     -> current_user = 'postgres', 'service_role', etc.
--
-- Por eso los guards nuevos son SECURITY INVOKER: dentro del trigger,
-- current_user es el rol de quien ejecuto el INSERT/UPDATE que lo disparo.
--
-- Consecuencia conocida y compensada: checkAchievements() otorgaba el premio
-- del logro con un UPDATE a profiles.points hecho con el JWT del usuario; con
-- este endurecimiento ese UPDATE queda neutralizado. El premio pasa a la base:
-- award_achievement_points() (DEFINER) lo otorga tras cada INSERT en
-- user_achievements. Sin la migracion la app sigue otorgando el premio ella
-- misma; con ella lo otorga el trigger y el UPDATE de la app es un no-op
-- inofensivo (el total es el mismo en ambos mundos, nunca se duplica: el
-- update fija un valor absoluto que coincide con lo ya otorgado).
--
-- Idempotente: todo se crea con CREATE OR REPLACE / DROP IF EXISTS.

-- ============================================
-- AB-02: GAME SESSIONS
-- ============================================

-- Insertar: anonimos con player_id NULL, o el propio usuario autenticado.
-- submitQuizResult inserta player_id = user?.id ?? null: cumple en ambos casos.
DROP POLICY IF EXISTS game_sessions_insert_any ON public.game_sessions;
DROP POLICY IF EXISTS game_sessions_insert_player ON public.game_sessions;

CREATE POLICY "game_sessions_insert_player" ON public.game_sessions
  FOR INSERT
  WITH CHECK (player_id IS NULL OR player_id = auth.uid());

-- Rangos minimos que el Zod ya exige (submission.ts) pero que PostgREST
-- saltaba. NOT VALID porque en produccion hay filas basura previas: se
-- validan las escrituras nuevas y las viejas quedan a decision editorial.
-- Tras limpiar, Diego puede correr:
--   ALTER TABLE public.game_sessions VALIDATE CONSTRAINT <nombre>;
ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_score_nonnegative,
  DROP CONSTRAINT IF EXISTS game_sessions_max_score_nonnegative,
  DROP CONSTRAINT IF EXISTS game_sessions_score_within_max,
  DROP CONSTRAINT IF EXISTS game_sessions_time_nonnegative;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_score_nonnegative
    CHECK (score >= 0) NOT VALID,
  ADD CONSTRAINT game_sessions_max_score_nonnegative
    CHECK (max_score >= 0) NOT VALID,
  ADD CONSTRAINT game_sessions_score_within_max
    CHECK (score <= max_score) NOT VALID,
  ADD CONSTRAINT game_sessions_time_nonnegative
    CHECK (time_taken_seconds IS NULL OR time_taken_seconds >= 0) NOT VALID;

-- ============================================
-- AB-03: PROFILES — columnas no editables por JWT
-- ============================================

-- Whitelist editable por el dueno: username, display_name, bio, avatar_url y
-- preferred_language (lo que escriben updateProfileAction y /api/locale).
-- Todo lo demas se restaura al valor anterior (UPDATE) o al default (INSERT).
CREATE OR REPLACE FUNCTION public.guard_profile_editable_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role, seeds, migraciones y triggers internos DEFINER
  -- (award_quiz_points, update_follow_counts, award_achievement_points,
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
  NEW.created_at := OLD.created_at;
  NEW.updated_at := OLD.updated_at;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_editable_columns() IS
  'Restaura columnas no editables de profiles en escrituras con JWT (anon/authenticated): puntos, contadores, is_admin, is_verified. Service role y triggers DEFINER pasan libres.';

-- El nombre ordena este trigger DESPUES de trigger_guard_profile_admin_flag
-- (010): el flag admin sigue levantando excepcion antes de que este restaure.
DROP TRIGGER IF EXISTS trigger_guard_profile_editable_columns ON public.profiles;
CREATE TRIGGER trigger_guard_profile_editable_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_editable_columns();

-- ============================================
-- AB-08: QUIZZES — columnas no editables por el creador
-- ============================================

CREATE OR REPLACE FUNCTION public.guard_quiz_editable_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mismo pase libre: service role, seeds, RPCs y triggers DEFINER
  -- (increment_plays, increment_shares, toggle_like, update_quiz_avg_score),
  -- y acciones FK.
  IF auth.uid() IS NULL OR current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Las estadisticas y el destacado editorial nacen en default en cualquier
    -- alta via PostgREST (createQuiz nunca los manda). El status NO se toca
    -- aqui: los 'published' sin admin ya los rechaza guard_quiz_publication.
    NEW.plays_count := 0;
    NEW.shares_count := 0;
    NEW.likes_count := 0;
    NEW.avg_score := 0;
    NEW.is_featured := false;
    NEW.featured_at := NULL;
    NEW.published_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE por JWT: identidad, estadisticas, destacado y sello editorial no
  -- se negocian. updated_at lo gestiona trg_quizzes_content_updated_at, que
  -- siempre lo reasigna (OLD o NOW): ningun cliente puede falsificarlo.
  NEW.id := OLD.id;
  NEW.creator_id := OLD.creator_id;
  NEW.plays_count := OLD.plays_count;
  NEW.shares_count := OLD.shares_count;
  NEW.likes_count := OLD.likes_count;
  NEW.avg_score := OLD.avg_score;
  NEW.is_featured := OLD.is_featured;
  NEW.featured_at := OLD.featured_at;
  NEW.published_at := OLD.published_at;
  NEW.is_ai_generated := OLD.is_ai_generated;
  NEW.created_at := OLD.created_at;

  -- status solo lo mueve la moderacion: un admin con JWT conserva la via que
  -- guard_quiz_publication (010) ya le permite; cualquier otro cambio de
  -- status por JWT se restaura (editar un quiz publicado no lo re-modera,
  -- decision de producto pendiente y fuera de esta migracion).
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin
     )
  THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_quiz_editable_columns() IS
  'Restaura columnas no editables de quizzes en escrituras con JWT (anon/authenticated): contadores, is_featured, published_at, status (salvo admin). Service role y triggers DEFINER pasan libres.';

DROP TRIGGER IF EXISTS trigger_guard_quiz_editable_columns ON public.quizzes;
CREATE TRIGGER trigger_guard_quiz_editable_columns
  BEFORE INSERT OR UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quiz_editable_columns();

-- increment_creator_quizzes escribe profiles.quizzes_created como INVOKER:
-- con la nueva guardia lo restauraria (y con la RLS actual ya fallaba en
-- silencio cuando el actor no era el propio creador). Pasa a DEFINER como
-- hicieron los triggers de follows/notificaciones en 011_fix_*: el contador
-- es sistema, no dato editable.
ALTER FUNCTION public.increment_creator_quizzes() SECURITY DEFINER;

-- ============================================
-- AB-09: USER ACHIEVEMENTS
-- ============================================

-- Insertar: solo logros del propio usuario. checkAchievements hace upsert con
-- user_id = auth.uid(): cumple. Los triggers DEFINER y la service role no
-- pasan por RLS.
DROP POLICY IF EXISTS user_achievements_insert_system ON public.user_achievements;
DROP POLICY IF EXISTS user_achievements_insert_own ON public.user_achievements;

CREATE POLICY "user_achievements_insert_own" ON public.user_achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- El premio de cada logro lo otorga la base, leyendo achievements.points_reward
-- en el momento del desbloqueo (mismo criterio que checkAchievements). Nace
-- para compensar la neutralizacion del UPDATE a points que hace la app: con
-- este trigger el desbloqueo paga siempre, venga de la app, de un seed o de
-- una escritura service role. ON CONFLICT de la app solo inserta una vez, asi
-- que no hay doble premio.
CREATE OR REPLACE FUNCTION public.award_achievement_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + COALESCE((
        SELECT a.points_reward
        FROM public.achievements a
        WHERE a.id = NEW.achievement_id
      ), 0),
      updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.award_achievement_points() IS
  'Otorga achievements.points_reward al desbloquear un logro. DEFINER: corre como dueno de la funcion y atraviesa guard_profile_editable_columns.';

DROP TRIGGER IF EXISTS trigger_award_achievement_points ON public.user_achievements;
CREATE TRIGGER trigger_award_achievement_points
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.award_achievement_points();
