-- 018 — Borrar cuenta: los reportes resueltos sobreviven sin quien los resolvió
--
-- `quiz_reports.resolved_by` (001) y `comment_reports.resolved_by` (017)
-- nacieron sin acción de borrado (NO ACTION), así que borrar el perfil de un
-- admin que resolvió reportes fallaba por la FK. El reporte no debe
-- desaparecer: es historial de moderación y se anonimiza.
--
-- `deleteAccountAction` ya pone `resolved_by = NULL` en ambas tablas antes de
-- borrar la cuenta, para funcionar aunque esta migración todavía no esté
-- aplicada. Esta migración cierra el mismo agujero para cualquier otro camino
-- de borrado (dashboard de Supabase, limpieza manual, futuros borrados
-- administrativos).
--
-- Va después de la 017 porque `comment_reports` nace ahí.
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
