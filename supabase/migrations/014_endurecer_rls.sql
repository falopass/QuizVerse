-- 014 — Endurecer RLS: partidas, perfiles, quizzes y logros
--
-- Cierra los agujeros AB-02/AB-03/AB-08/AB-09 del informe scout-auth-backend.
-- Se aplica DESPUES de la 013 (013_lockdown_rpc_and_sessions), que cubre otro
-- frente del mismo endurecimiento: grants por columna en profiles, lectura de
-- game_sessions por token y la RPC unlock_achievement que paga los premios de
-- forma atomica.
--
-- Reparto tras la reconciliacion (lo que la 013 ya resuelve NO se repite):
--   * AB-02 — la 013 no toco el INSERT de game_sessions: sigue abierto a
--     partidas fabricadas con player_id ajeno y valores absurdos. Aqui va la
--     policy de dueno/anonimo y el guard de rangos.
--   * AB-03 — la 013 limita el UPDATE de profiles por privilegio de columna,
--     pero el REVOKE no alcanza el INSERT: profiles_insert_own (002) aun
--     deja crear la propia fila con points o flags arbitrarios. El guard se
--     queda: sanea el INSERT con JWT y queda como segunda capa del UPDATE si
--     un grant futuro reabriera columnas.
--   * AB-08 — la 013 no toco quizzes: el guard del creador (contadores,
--     is_featured, published_at, status salvo admin o archivo propio) sigue
--     siendo necesario entero.
--   * AB-09 — la 013 dejo user_achievements_insert_system solo con
--     user_id = auth.uid(): un INSERT propio fabricado planta el logro en el
--     perfil (sin premio, pero visible). La puerta de aqui exige ademas la
--     condicion cumplida (achievement_condition_met). El PAGO lo hace solo
--     unlock_achievement (013): esta migracion no crea trigger de premio para
--     que un desbloqueo por RPC no cobre dos veces. El INSERT directo de la
--     app (fallback cuando el RPC no existe) solo puede plantar logros ya
--     ganados — sin pagar, como debe ser.
--
-- Discriminante de escritura directa (igual que en 010): no auth.uid() sino
-- current_user — un SECURITY DEFINER corre con el JWT de la request original.
--   * PostgREST con JWT de usuario      -> current_user = 'authenticated'
--     (o 'anon' si alguna vez escribiera con la publishable key).
--   * Triggers internos DEFINER, service role, seeds, migraciones y acciones
--     FK (ON DELETE SET NULL / CASCADE) -> 'postgres', 'service_role', etc.
-- Los guards son SECURITY INVOKER: dentro del trigger, current_user es el rol
-- de quien ejecuto el INSERT/UPDATE que lo disparo.
--
-- Orden de aplicacion: 013 -> 014. Sin la 013, la 014 deja el premio de
-- logros sin via de pago (el UPDATE de la app queda neutralizado por el guard
-- de profiles, que es lo correcto); con la 013, unlock_achievement paga solo.
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
-- saltaba. Van en un guard BEFORE INSERT y NO en CHECK constraints: los CHECK
-- se re-evaluan en cada UPDATE, asi que una fila basura preexistente
-- bloquearia hasta la cascada ON DELETE SET NULL del borrado de una cuenta.
-- No existe policy de UPDATE sobre game_sessions, asi que validar el INSERT
-- cubre toda escritura posible de usuarios; las correcciones por service role
-- no requieren permiso. Las filas basura actuales quedan intactas: limpiarlas
-- es decision editorial, documentada en el PR.
CREATE OR REPLACE FUNCTION public.guard_game_session_ranges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.score < 0
     OR NEW.max_score < 0
     OR NEW.score > NEW.max_score
     OR NEW.time_taken_seconds < 0
  THEN
    RAISE EXCEPTION 'Resultado de partida fuera de rango'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_game_session_ranges() IS
  'Rechaza inserts de game_sessions con score/max_score/tiempo fuera de rango (mismos limites que el Zod de submission). BEFORE INSERT: no estorba cascadas FK ni correcciones service role sobre filas antiguas.';

DROP TRIGGER IF EXISTS trigger_guard_game_session_ranges ON public.game_sessions;
CREATE TRIGGER trigger_guard_game_session_ranges
  BEFORE INSERT ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_game_session_ranges();

-- ============================================
-- AB-03: PROFILES — columnas no editables por JWT
-- ============================================

-- La 013 ya cerro el UPDATE por privilegio (authenticated solo puede tocar
-- username, display_name, bio y preferred_language). Este guard es la segunda
-- capa: sanea el INSERT — que el REVOKE no alcanza — y mantiene la whitelist
-- completa del encargo si un grant futuro reabriera columnas. Whitelist:
-- username, display_name, bio, avatar_url y preferred_language.
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

-- La 013 concedio UPDATE por columna sobre (username, display_name, bio,
-- preferred_language). La whitelist del encargo incluye tambien avatar_url:
-- grant aditivo e idempotente, no quita nada de lo que la 013 dejo.
GRANT UPDATE (avatar_url) ON public.profiles TO authenticated;

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
  -- guard_quiz_publication (010) ya le permite. La unica excepcion para el
  -- resto es 'archived', estado que el enum reserva al propio creador
  -- ("Archivado por el creador o admin", 001). Editar un quiz publicado no lo
  -- re-modera: decision de producto pendiente, fuera de esta migracion.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'archived'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin
     )
  THEN
    NEW.status := OLD.status;
  END IF;

  -- Si tras las restauraciones la unica diferencia real es updated_at (p.ej.
  -- un PATCH que solo tocaba columnas protegidas), se revierte tambien: el
  -- lastmod del sitemap no debe moverse por una escritura que no cambio nada.
  IF (NEW.id, NEW.creator_id, NEW.category_id, NEW.title, NEW.slug,
      NEW.description, NEW.cover_image_url, NEW.quiz_type, NEW.difficulty,
      NEW.language, NEW.questions, NEW.results, NEW.tags,
      NEW.estimated_minutes, NEW.plays_count, NEW.shares_count, NEW.avg_score,
      NEW.likes_count, NEW.status, NEW.is_featured, NEW.is_ai_generated,
      NEW.featured_at, NEW.published_at, NEW.created_at)
     IS NOT DISTINCT FROM
     (OLD.id, OLD.creator_id, OLD.category_id, OLD.title, OLD.slug,
      OLD.description, OLD.cover_image_url, OLD.quiz_type, OLD.difficulty,
      OLD.language, OLD.questions, OLD.results, OLD.tags,
      OLD.estimated_minutes, OLD.plays_count, OLD.shares_count, OLD.avg_score,
      OLD.likes_count, OLD.status, OLD.is_featured, OLD.is_ai_generated,
      OLD.featured_at, OLD.published_at, OLD.created_at)
  THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_quiz_editable_columns() IS
  'Restaura columnas no editables de quizzes en escrituras con JWT (anon/authenticated): contadores, is_featured, published_at, status (salvo admin o archivo propio). Service role y triggers DEFINER pasan libres.';

DROP TRIGGER IF EXISTS trigger_guard_quiz_editable_columns ON public.quizzes;
CREATE TRIGGER trigger_guard_quiz_editable_columns
  BEFORE INSERT OR UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quiz_editable_columns();

-- increment_creator_quizzes escribe profiles.quizzes_created: si corre como
-- INVOKER el guard lo restaura (y con la RLS actual ya fallaba en silencio
-- cuando el actor no era el propio creador). La 013 ya lo redefinio DEFINER,
-- asi que sobre 013+014 esto es no-op; se mantiene para que la 014 sea
-- autosuficiente si se aplicara sola.
ALTER FUNCTION public.increment_creator_quizzes() SECURITY DEFINER;

-- ============================================
-- AB-09: USER ACHIEVEMENTS
-- ============================================

-- Puerta del INSERT directo: la 013 ya exige user_id = auth.uid() pero no
-- verifica la condicion — un usuario podia sembrarse 'internet_famous' (sin
-- premio, pero visible en su perfil). Esta funcion evalua la condicion con
-- los datos del schema: contadores del perfil para 'plays'/'creates' y una
-- partida perfecta real para 'score'. Los tipos que el schema aun no puede
-- medir ('shares', 'streak', 'categories', 'share') devuelven false: tampoco
-- la app ni unlock_achievement los desbloquean hoy.
CREATE OR REPLACE FUNCTION public.achievement_condition_met(
  p_user_id uuid,
  p_achievement_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  cond_type text;
  cond_value integer;
BEGIN
  -- Como RPC es invocable por cualquiera: solo se responde sobre el propio
  -- uid, o devuelve false. Sin este corte mediria logros de otros usuarios
  -- (user_achievements solo es legible por su dueno).
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN false;
  END IF;

  SELECT condition_type, condition_value
    INTO cond_type, cond_value
    FROM public.achievements
    WHERE id = p_achievement_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  CASE cond_type
    WHEN 'plays' THEN
      RETURN COALESCE((
        SELECT quizzes_played FROM public.profiles WHERE id = p_user_id
      ), 0) >= cond_value;
    WHEN 'creates' THEN
      RETURN COALESCE((
        SELECT quizzes_created FROM public.profiles WHERE id = p_user_id
      ), 0) >= cond_value;
    WHEN 'score' THEN
      -- cond_value es el porcentaje exigido (100 = partida perfecta).
      RETURN EXISTS (
        SELECT 1 FROM public.game_sessions s
        WHERE s.player_id = p_user_id
          AND s.max_score > 0
          AND s.score * 100 >= s.max_score * cond_value
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.achievement_condition_met(uuid, text) IS
  'Verdadero si el logro ya esta ganado segun achievements.condition_type/value (contadores de perfil, o una partida con el porcentaje exigido). Usado por user_achievements_insert_own.';

-- Insertar: solo logros propios y ya cumplidos. El fallback de la app (upsert
-- directo si el RPC no existe) solo se da cuando la condicion se satisface:
-- cumple. Un INSERT fabricado por PostgREST no cumple la puerta y se rechaza
-- entero. Y el insert de unlock_achievement es DEFINER: salta RLS y no pasa
-- por esta policy.
DROP POLICY IF EXISTS user_achievements_insert_system ON public.user_achievements;
DROP POLICY IF EXISTS user_achievements_insert_own ON public.user_achievements;

CREATE POLICY "user_achievements_insert_own" ON public.user_achievements
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.achievement_condition_met(user_id, achievement_id)
  );

-- Sin trigger de premio aqui, a proposito: el unico pagador es
-- unlock_achievement (013), atomico y verificado en servidor. Un AFTER INSERT
-- propio pagaria otra vez sobre el insert interno de la RPC (doble cobro) y
-- premiaria cualquier insert service role por el camino equivocado. Los DROP
-- limpian el enfoque anterior de esta migracion si alguien lo aplico en local.
DROP TRIGGER IF EXISTS trigger_award_achievement_points ON public.user_achievements;
DROP FUNCTION IF EXISTS public.award_achievement_points();
