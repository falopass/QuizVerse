-- 028 — Borrado de cuenta atómico en PostgreSQL (hallazgo A-12)
--
-- Problema:
--   `deleteAccountAction` anonimizaba referencias antes de llamar a
--   `auth.admin.deleteUser` y borraba borradores/notificaciones DESPUÉS.
--   Si el borrado de borradores fallaba tras eliminar `auth.users`, la FK
--   `quizzes.creator_id ON DELETE SET NULL` dejaba borradores privados
--   huérfanos sin dueño y sin reintento desde la cuenta ya borrada.
--
-- Solución:
--   Un trigger `BEFORE DELETE ON public.profiles` ejecuta toda la limpieza
--   acotada al usuario DENTRO de la misma transacción PostgreSQL que elimina
--   `auth.users` (vía cascada `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`):
--     1. Borra quizzes no publicados (`status <> 'published'`) del usuario
--        antes de que la FK ponga `creator_id = NULL`. Los publicados se
--        conservan y quedan con `creator_id = NULL`.
--     2. Borra notificaciones de terceros que mencionan al usuario
--        (`data->>'user_id'` o `data->>'follower_id'`).
--     3. Anonimiza `quiz_reports.resolved_by`, `comment_reports.resolved_by` y
--        `quizzes.moderated_by` antes de evaluar las FKs (funciona tanto con
--        019 aplicada como en instalaciones sin 019).
--   Si cualquier paso falla, PostgreSQL hace rollback completo de la
--   transacción: `auth.users`, `profiles`, borradores y referencias quedan
--   intactos.
--
-- Además asegura de forma idempotente las FKs `ON DELETE SET NULL` de 019
-- cuando las tablas/columnas existen, y expone `has_atomic_account_deletion()`
-- solo a `service_role` para que `deleteAccountAction` detecte si esta
-- migración ya está aplicada (compatibilidad dual antes y después de aplicarla).
--
-- Verificación tras aplicar:
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'public.profiles'::regclass
--     AND tgname = 'trg_profiles_atomic_account_cleanup';
--   SELECT public.has_atomic_account_deletion();
--
-- Rollback (pegar y ejecutar si hay que volver atrás):
--   DROP TRIGGER IF EXISTS trg_profiles_atomic_account_cleanup ON public.profiles;
--   DROP FUNCTION IF EXISTS public.cleanup_profile_before_delete();
--   DROP FUNCTION IF EXISTS public.has_atomic_account_deletion();

-- ============================================
-- 1. Asegurar FKs ON DELETE SET NULL (idempotente, compatible sin 019/016/017)
-- ============================================

DO $$
BEGIN
  IF to_regclass('public.quiz_reports') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'quiz_reports'
         AND column_name = 'resolved_by'
     )
  THEN
    ALTER TABLE public.quiz_reports
      DROP CONSTRAINT IF EXISTS quiz_reports_resolved_by_fkey;
    ALTER TABLE public.quiz_reports
      ADD CONSTRAINT quiz_reports_resolved_by_fkey
      FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.comment_reports') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'comment_reports'
         AND column_name = 'resolved_by'
     )
  THEN
    ALTER TABLE public.comment_reports
      DROP CONSTRAINT IF EXISTS comment_reports_resolved_by_fkey;
    ALTER TABLE public.comment_reports
      ADD CONSTRAINT comment_reports_resolved_by_fkey
      FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.quizzes') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'quizzes'
         AND column_name = 'moderated_by'
     )
  THEN
    ALTER TABLE public.quizzes
      DROP CONSTRAINT IF EXISTS quizzes_moderated_by_fkey;
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_moderated_by_fkey
      FOREIGN KEY (moderated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ============================================
-- 2. Trigger BEFORE DELETE ON public.profiles
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_profile_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1) Borradores privados: se eliminan en la misma transacción mientras
  --    todavía pertenecen a OLD.id. Los publicados sobreviven con creator_id NULL.
  DELETE FROM public.quizzes
  WHERE creator_id = OLD.id
    AND status <> 'published';

  -- 2) Notificaciones de terceros que mencionan a la cuenta borrada.
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications
    WHERE data->>'user_id' = OLD.id::text
       OR data->>'follower_id' = OLD.id::text;
  END IF;

  -- 3) Referencias de moderación: se anonimizan antes de evaluar FKs
  --    (garantiza atomicidad incluso si alguna FK siguió en NO ACTION).
  IF to_regclass('public.quiz_reports') IS NOT NULL THEN
    UPDATE public.quiz_reports
    SET resolved_by = NULL
    WHERE resolved_by = OLD.id;
  END IF;

  IF to_regclass('public.comment_reports') IS NOT NULL THEN
    UPDATE public.comment_reports
    SET resolved_by = NULL
    WHERE resolved_by = OLD.id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quizzes'
      AND column_name = 'moderated_by'
  ) THEN
    UPDATE public.quizzes
    SET moderated_by = NULL
    WHERE moderated_by = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.cleanup_profile_before_delete() IS
  'Elimina borradores privados, notificaciones de terceros y anonimiza referencias de moderación dentro de la misma transacción que elimina auth.users/profiles (migración 028).';

DROP TRIGGER IF EXISTS trg_profiles_atomic_account_cleanup ON public.profiles;
CREATE TRIGGER trg_profiles_atomic_account_cleanup
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_profile_before_delete();

-- ============================================
-- 3. Marcador de capacidad para detección en runtime (solo service_role)
-- ============================================

CREATE OR REPLACE FUNCTION public.has_atomic_account_deletion()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT true;
$$;

COMMENT ON FUNCTION public.has_atomic_account_deletion() IS
  'Confirma a service_role que la migración 028 (borrado atómico de cuenta) está aplicada.';

REVOKE ALL ON FUNCTION public.has_atomic_account_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_atomic_account_deletion() TO service_role;
