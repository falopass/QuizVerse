-- 023_proteger_reportes_quiz.sql
--
-- Cierre del hallazgo A-08 (integridad de reportes de quizzes):
--
-- Problema:
--   * `quiz_reports_insert_authenticated` (002) permitía insertar filas en
--     `quiz_reports` directamente por PostgREST como `anon` o `authenticated`,
--     saltando el rate limit y la validación de `POST /api/quiz/report`.
--   * Ni la policy ni el trigger de 016 bloqueaban campos administrativos al
--     insertar (`resolved`, `resolved_by`, `resolved_at`), ni validaban que el
--     quiz objetivo estuviera publicado, ni sobreescribían `quiz_title`/
--     `quiz_slug` cuando el cliente mandaba un título falso.
--   * No existía deduplicación de reportes abiertos (ni autenticados ni
--     anónimos sin PII).
--
-- Solución:
--   1. La escritura de `quiz_reports` queda reservada al escritor validado de
--      servidor (`service_role` desde `POST /api/quiz/report`), conservando
--      los reportes anónimos (`reporter_id IS NULL`) y su deduplicación sin
--      PII mediante `reporter_fingerprint` (SHA-256).
--   2. El trigger `guard_quiz_report()` exige en INSERT que el quiz objetivo
--      exista y esté `published`, rellena siempre `quiz_title` y `quiz_slug`
--      desde `public.quizzes`, valida el largo de `details` y fuerza el estado
--      inicial (`resolved = false`, `resolved_by = NULL`, `resolved_at = NULL`).
--   3. En UPDATE, los moderadores (`profiles.is_admin = true`) conservan la
--      resolución (`resolved`, `resolved_by`, `resolved_at`), con evidencia
--      congelada y privilegios por columna; `service_role` y las cascadas FK
--      (`ON DELETE SET NULL`) siguen pasando sin bloqueo.
--
-- Orden y compatibilidad:
--   * Desplegar el código de L2 (`POST /api/quiz/report` con `createServiceClient`)
--     ANTES de aplicar esta migración en producción.
--   * Idempotente: ADD COLUMN IF NOT EXISTS, CREATE [UNIQUE] INDEX IF NOT EXISTS,
--     CREATE OR REPLACE FUNCTION, DROP/CREATE POLICY y TRIGGER, REVOKE/GRANT
--     repetibles.

-- ============================================
-- Columnas de evidencia y huella sin PII
-- ============================================

ALTER TABLE public.quiz_reports
  ADD COLUMN IF NOT EXISTS quiz_title TEXT,
  ADD COLUMN IF NOT EXISTS quiz_slug TEXT,
  ADD COLUMN IF NOT EXISTS reporter_fingerprint TEXT;

COMMENT ON COLUMN public.quiz_reports.reporter_fingerprint IS
  'Digest SHA-256 sin PII para deduplicar reportes abiertos anónimos del mismo origen sobre el mismo quiz.';

-- Backfill de snapshot en reportes históricos sin título/slug.
UPDATE public.quiz_reports r
SET quiz_title = q.title,
    quiz_slug = q.slug
FROM public.quizzes q
WHERE r.quiz_id = q.id
  AND (r.quiz_title IS NULL OR r.quiz_slug IS NULL);

-- ============================================
-- Deduplicación de reportes abiertos e índice de cola pendiente
-- ============================================

-- Consolida duplicados abiertos históricos del mismo (quiz_id, reporter_id)
-- conservando todas las filas como evidencia y dejando abierto el más reciente,
-- para que la creación del índice único no falle sobre datos previos a 023.
WITH ranked_open_reports AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY quiz_id, reporter_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.quiz_reports
  WHERE NOT resolved
    AND quiz_id IS NOT NULL
    AND reporter_id IS NOT NULL
)
UPDATE public.quiz_reports r
SET resolved = true,
    resolved_at = COALESCE(r.resolved_at, now())
FROM ranked_open_reports d
WHERE r.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_reports_open_by_user_once
  ON public.quiz_reports (quiz_id, reporter_id)
  WHERE NOT resolved
    AND quiz_id IS NOT NULL
    AND reporter_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_reports_open_by_fingerprint_once
  ON public.quiz_reports (quiz_id, reporter_fingerprint)
  WHERE NOT resolved
    AND quiz_id IS NOT NULL
    AND reporter_id IS NULL
    AND reporter_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_reports_pending
  ON public.quiz_reports (created_at DESC)
  WHERE NOT resolved;

-- ============================================
-- Guarda de integridad en INSERT y UPDATE
-- ============================================

CREATE OR REPLACE FUNCTION public.guard_quiz_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title TEXT;
  v_slug TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.quiz_id IS NULL THEN
      RAISE EXCEPTION 'El reporte requiere un quiz publicado'
        USING ERRCODE = '42501';
    END IF;

    SELECT q.title, q.slug
      INTO v_title, v_slug
    FROM public.quizzes q
    WHERE q.id = NEW.quiz_id
      AND q.status = 'published';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Solo se pueden reportar quizzes publicados'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.details IS NOT NULL AND char_length(NEW.details) > 1000 THEN
      RAISE EXCEPTION 'El detalle del reporte supera el límite permitido'
        USING ERRCODE = '23514';
    END IF;

    -- Snapshot y estado inicial siempre controlados por la base.
    NEW.quiz_title := v_title;
    NEW.quiz_slug := v_slug;
    NEW.resolved := false;
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: las acciones FK (ON DELETE SET NULL sobre quiz o perfil) corren
  -- como trigger anidado con el mismo rol de la request.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Service role / mantenimiento (p. ej. anonimización al borrar cuenta).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede resolver reportes de quizzes'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.quiz_id IS DISTINCT FROM OLD.quiz_id
     OR NEW.quiz_title IS DISTINCT FROM OLD.quiz_title
     OR NEW.quiz_slug IS DISTINCT FROM OLD.quiz_slug
     OR NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
     OR NEW.reporter_fingerprint IS DISTINCT FROM OLD.reporter_fingerprint
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.details IS DISTINCT FROM OLD.details
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo se pueden actualizar las columnas de resolución del reporte'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
     AND NEW.resolved_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'resolved_by debe registrar a quien resuelve'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_quiz_report() IS
  'Exige objetivo publicado, rellena snapshot autoritativo y fuerza estado inicial en INSERT; en UPDATE congela la evidencia y reserva la resolución a admins (service_role y cascadas FK pasan libres).';

-- Sustituye trg_quiz_reports_snapshot (016), que solo rellenaba cuando quiz_title era NULL.
DROP TRIGGER IF EXISTS trg_quiz_reports_snapshot ON public.quiz_reports;
DROP TRIGGER IF EXISTS trigger_guard_quiz_report ON public.quiz_reports;
CREATE TRIGGER trigger_guard_quiz_report
  BEFORE INSERT OR UPDATE ON public.quiz_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quiz_report();

-- ============================================
-- Políticas RLS y privilegios mínimos
-- ============================================

DROP POLICY IF EXISTS "quiz_reports_insert_authenticated" ON public.quiz_reports;
DROP POLICY IF EXISTS "quiz_reports_insert_none" ON public.quiz_reports;
CREATE POLICY "quiz_reports_insert_none" ON public.quiz_reports
  FOR INSERT
  WITH CHECK (false);

COMMENT ON POLICY "quiz_reports_insert_none" ON public.quiz_reports IS
  'Sin inserts directos desde PostgREST: POST /api/quiz/report escribe con service_role tras validar cuerpo, límite y objetivo.';

DROP POLICY IF EXISTS "quiz_reports_update_admin" ON public.quiz_reports;
CREATE POLICY "quiz_reports_update_admin" ON public.quiz_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.quiz_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quiz_reports TO authenticated;
GRANT UPDATE (resolved, resolved_by, resolved_at) ON public.quiz_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_reports TO service_role;
