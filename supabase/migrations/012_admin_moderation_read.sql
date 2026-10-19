-- 012 — Los reportes solo los lee la moderación, y el admin lee el quiz reportado
--
-- Problema: `quiz_reports_read_authenticated` (migración 002) deja que
-- cualquier usuario con sesión lea la tabla entera de reportes, incluido el
-- detalle y el `reporter_id`. Además `quizzes_public_read` solo cubre
-- 'published' para terceros, así que el join del panel de moderación llegaría
-- vacío si el quiz reportado cambiara de estado (rejected, archived).
--
-- Solución: la lectura de `quiz_reports` pasa a exigir `profiles.is_admin` y se
-- añade lectura admin de `quizzes` en cualquier estado. El UPDATE de reportes
-- ya era admin (`quiz_reports_update_admin`, 002) y el INSERT anónimo de
-- /api/quiz/report no se toca: reportar sigue abierto por diseño. En sesiones
-- sin JWT y service role `auth.uid()` es NULL y la condición nunca se cumple.

DROP POLICY IF EXISTS quiz_reports_read_authenticated ON public.quiz_reports;

CREATE POLICY "quiz_reports_read_admin" ON public.quiz_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "quizzes_admin_read" ON public.quizzes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
