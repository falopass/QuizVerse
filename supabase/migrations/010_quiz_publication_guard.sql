-- 010 — Guardia de publicación de quizzes
--
-- Problema: RLS no puede restringir columnas. `quizzes_update_own` solo exige
-- `creator_id = auth.uid()` y `quizzes_insert_authenticated` no mira `status`,
-- así que un creador autenticado podía pegarle directo a PostgREST
-- (PATCH /quizzes SET status='published') y autopublicarse saltándose la
-- moderación. Quitar `status` del schema de `updateQuiz` (commit anterior)
-- ordena la app pero no cierra este camino.
--
-- Solución: trigger BEFORE INSERT OR UPDATE que solo deja llevar un quiz a
-- 'published' si el actor es admin (`profiles.is_admin`, mismo patrón que
-- `quiz_reports_update_admin`). Las sesiones sin `auth.uid()` (service role,
-- seeds, migraciones) pasan libres.

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
