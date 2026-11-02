-- 019 — Borrar cuenta: las referencias de moderación sobreviven sin la cuenta
--
-- Tres columnas apuntan a `profiles` sin acción de borrado (NO ACTION), así
-- que borrar el perfil de un admin fallaba por la FK:
--
--   * quiz_reports.resolved_by   (001)
--   * comment_reports.resolved_by (017)
--   * quizzes.moderated_by        (016)
--
-- Ninguna de esas filas debe desaparecer: son historial de moderación o
-- contenido publicado. Se anonimizan.
--
-- `deleteAccountAction` ya pone esas columnas a NULL antes de borrar la
-- cuenta, para funcionar aunque esta migración todavía no esté aplicada. Esta
-- migración cierra el mismo agujero para cualquier otro camino de borrado
-- (dashboard de Supabase, limpieza manual, futuros borrados administrativos).
--
-- Va después de la 018 para que las tres columnas existan.
-- Idempotente: DROP IF EXISTS + ADD.

ALTER TABLE public.quiz_reports
  DROP CONSTRAINT IF EXISTS quiz_reports_resolved_by_fkey;

ALTER TABLE public.quiz_reports
  ADD CONSTRAINT quiz_reports_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.comment_reports
  DROP CONSTRAINT IF EXISTS comment_reports_resolved_by_fkey;

ALTER TABLE public.comment_reports
  ADD CONSTRAINT comment_reports_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_moderated_by_fkey;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_moderated_by_fkey
  FOREIGN KEY (moderated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
