-- 010 — Guardias de moderación: publicación de quizzes y flag is_admin
--
-- Problema: RLS no puede restringir columnas. Dos policies legítimas formaban
-- una cadena de ascenso de privilegio:
--
--   1. `profiles_update_own` deja al usuario editar cualquier columna de su
--      propia fila, incluido `is_admin`.
--   2. `quizzes_insert_authenticated` / `quizzes_update_own` solo exigen
--      `creator_id = auth.uid()`, sin mirar `status`.
--
-- Así, un creador autenticado podía pegarle directo a PostgREST:
-- `UPDATE profiles SET is_admin=true` y después
-- `INSERT/PATCH quizzes ... status='published'`, saltándose la moderación.
-- Quitar `status` del schema de `updateQuiz` (commit anterior) ordena la app
-- pero no cierra estos caminos: el cierre va en la base.
--
-- Solución: dos triggers BEFORE INSERT OR UPDATE.
--   * `guard_quiz_publication` — llevar un quiz a 'published' exige que el
--     actor sea admin. Editar un quiz ya publicado sin tocar `status` no pide
--     admin.
--   * `guard_profile_admin_flag` — tocar `is_admin` exige que el actor ya sea
--     admin (o que la fila ya lo fuera); insertar un perfil con `is_admin`
--     está prohibido por JWT. El primer admin se crea por SQL/service role.
-- En ambos, las sesiones sin `auth.uid()` (service role, seeds, migraciones,
-- alta de GoTrue) pasan libres.

CREATE OR REPLACE FUNCTION public.guard_quiz_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role / seeds / migraciones no llevan JWT: pasan sin chequeo.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo importa el momento en que un quiz LLEGA a 'published': un insert ya
  -- publicado, o un update que cambia el status. Editar un quiz que ya estaba
  -- publicado sin tocar el status no pide admin.
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin
     )
  THEN
    RAISE EXCEPTION 'Solo un administrador puede publicar un quiz'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_quiz_publication() IS
  'Impide que un usuario autenticado lleve un quiz a status published salvo que sea admin. Service role (auth.uid() NULL) pasa libre.';

DROP TRIGGER IF EXISTS trigger_guard_quiz_publication ON public.quizzes;
CREATE TRIGGER trigger_guard_quiz_publication
  BEFORE INSERT OR UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quiz_publication();

CREATE OR REPLACE FUNCTION public.guard_profile_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role / seeds / alta de GoTrue no llevan JWT: pasan sin chequeo.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ningun actor con JWT puede insertar un perfil ya admin: el alta real corre
  -- sin JWT y los ascensos se hacen por UPDATE o por service role.
  IF TG_OP = 'INSERT' AND NEW.is_admin IS TRUE THEN
    RAISE EXCEPTION 'Solo un administrador puede otorgar is_admin'
      USING ERRCODE = '42501';
  END IF;

  -- En UPDATE, tocar is_admin solo lo puede hacer un admin (o alguien que edita
  -- una fila que ya era admin, p.ej. un admin quitandose el flag). Bajo
  -- profiles_update_own el actor solo alcanza su propia fila, asi que esta
  -- regla bloquea el auto-ascenso sin impedir la edicion normal del perfil.
  IF TG_OP = 'UPDATE'
     AND NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND OLD.is_admin IS NOT TRUE
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin
     )
  THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar is_admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_profile_admin_flag() IS
  'Impide el auto-ascenso a admin por PostgREST: is_admin solo lo cambia un admin existente o el service role (auth.uid() NULL).';

DROP TRIGGER IF EXISTS trigger_guard_profile_admin_flag ON public.profiles;
CREATE TRIGGER trigger_guard_profile_admin_flag
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_admin_flag();
