-- 017 — Moderación de comentarios: ocultar, borrado admin y reportes
--
-- Problema (COM-01): un comentario ofensivo no se podía quitar desde la app.
-- Solo el autor podía borrar el suyo (migración 005), no había forma de
-- reportar comentarios ni de ocultarlos sin borrarlos.
--
-- Cambios:
--   * quiz_comments gana hidden_at/hidden_by: el creador del quiz y el admin
--     ocultan sin borrar. El comentario oculto desaparece de la lectura
--     pública pero sigue visible para quien modera y para su autor.
--   * La lectura pública exige hidden_at IS NULL; una policy de moderación
--     deja leer todo al admin y al creador del quiz (incluso ocultos).
--   * Nuevas policies de escritura: UPDATE del creador del quiz y del admin
--     (limitadas por el trigger guard_comment_moderation a las columnas de
--     ocultado) y DELETE de admin.
--   * Nueva tabla comment_reports: reportar exige sesión, guarda una copia
--     del cuerpo reportado (evidencia aunque el comentario se borre después)
--     y lo resuelve el admin desde /admin/reportes.

ALTER TABLE public.quiz_comments
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Lectura pública: comentarios visibles en quizzes publicados. El autor sigue
-- viendo el suyo aunque esté oculto (la UI lo etiqueta), para que sepa qué pasó.
DROP POLICY IF EXISTS "Anyone can read comments" ON public.quiz_comments;
DROP POLICY IF EXISTS "quiz_comments_read_public" ON public.quiz_comments;
CREATE POLICY "quiz_comments_read_public" ON public.quiz_comments
  FOR SELECT
  USING (
    (hidden_at IS NULL OR auth.uid() = user_id)
    AND EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = quiz_comments.quiz_id
      AND quizzes.status = 'published'
    )
  );

-- Lectura de moderación: el admin lo ve todo y el creador del quiz ve los
-- comentarios de su quiz en cualquier estado (incluidos los ocultos).
DROP POLICY IF EXISTS "quiz_comments_read_moderation" ON public.quiz_comments;
CREATE POLICY "quiz_comments_read_moderation" ON public.quiz_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = quiz_comments.quiz_id
      AND quizzes.creator_id = auth.uid()
    )
  );

-- Ocultar/mostrar: el creador del quiz y el admin actualizan el comentario.
-- RLS no restringe columnas: el trigger de abajo limita esos UPDATE a
-- hidden_at/hidden_by para que nadie reescriba el texto ajeno.
DROP POLICY IF EXISTS "quiz_comments_update_quiz_creator" ON public.quiz_comments;
CREATE POLICY "quiz_comments_update_quiz_creator" ON public.quiz_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = quiz_comments.quiz_id
      AND quizzes.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = quiz_comments.quiz_id
      AND quizzes.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "quiz_comments_update_admin" ON public.quiz_comments;
CREATE POLICY "quiz_comments_update_admin" ON public.quiz_comments
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

DROP POLICY IF EXISTS "quiz_comments_delete_admin" ON public.quiz_comments;
CREATE POLICY "quiz_comments_delete_admin" ON public.quiz_comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Guarda de columnas: un UPDATE que no viene del autor solo puede tocar
-- hidden_at/hidden_by, y al ocultar hidden_by queda firmado con auth.uid().
-- El autor puede editar su texto, pero tocar el ocultado exige además ser
-- moderador (creador del quiz o admin): un autor normal no puede desocultar
-- lo que la moderación ocultó, y si quiere quitar su comentario lo borra.
CREATE OR REPLACE FUNCTION public.guard_comment_moderation()
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

  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.quiz_id IS DISTINCT FROM OLD.quiz_id
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      RAISE EXCEPTION 'Solo se pueden cambiar hidden_at y hidden_by'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.hidden_at IS NOT NULL AND NEW.hidden_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'hidden_by debe registrar a quien modera'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
       OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.quizzes
        WHERE quizzes.id = OLD.quiz_id
        AND quizzes.creator_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'El autor no puede cambiar el ocultado de su comentario'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.hidden_at IS NOT NULL AND NEW.hidden_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'hidden_by debe registrar a quien modera'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_comment_moderation() IS
  'Limita los UPDATE de no-autores a hidden_at/hidden_by (firma con auth.uid()). El autor solo toca el ocultado si además modera (creador del quiz o admin). Service role pasa libre.';

DROP TRIGGER IF EXISTS trigger_guard_comment_moderation ON public.quiz_comments;
CREATE TRIGGER trigger_guard_comment_moderation
  BEFORE UPDATE ON public.quiz_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_comment_moderation();

-- Reportes de comentarios. A diferencia de quiz_reports, aquí el reporte exige
-- sesión (reporter_id NOT NULL al insertar vía policy) y guarda una copia del
-- cuerpo y el quiz del momento: si el comentario se borra, la evidencia queda.
CREATE TABLE IF NOT EXISTS public.comment_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES public.quiz_comments(id) ON DELETE SET NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  comment_body TEXT NOT NULL,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  details TEXT CHECK (char_length(details) <= 1000),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON public.comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_pending
  ON public.comment_reports(created_at DESC)
  WHERE NOT resolved;

-- Un reporte abierto por par (comentario, reportante): al resolverse se puede
-- reportar de nuevo. La app lo traduce a un 'conflict' legible.
CREATE UNIQUE INDEX IF NOT EXISTS comment_reports_open_once
  ON public.comment_reports(comment_id, reporter_id)
  WHERE NOT resolved;

ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

-- Guarda de evidencia: en INSERT la copia del comentario debe coincidir con
-- la fila real (nadie fabrica "pruebas" contra un comentario ajeno por
-- PostgREST); en UPDATE solo se pueden mover las columnas de resolución, así
-- el contenido reportado queda congelado una vez en la cola.
CREATE OR REPLACE FUNCTION public.guard_comment_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Las acciones de clave foránea (ON DELETE SET NULL) actualizan el reporte
  -- desde un trigger anidado con el mismo rol de la request: sin esta salida,
  -- borrar un comentario, un quiz o un perfil revertiría la transacción
  -- entera. No hay otros triggers sobre esta tabla que puedan anidarse aquí.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.comment_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.quiz_comments c
         WHERE c.id = NEW.comment_id
           AND c.body = NEW.comment_body
           AND c.quiz_id IS NOT DISTINCT FROM NEW.quiz_id
       ) THEN
      RAISE EXCEPTION 'El reporte no coincide con el comentario indicado'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.comment_id IS DISTINCT FROM OLD.comment_id
     OR NEW.quiz_id IS DISTINCT FROM OLD.quiz_id
     OR NEW.comment_body IS DISTINCT FROM OLD.comment_body
     OR NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.details IS DISTINCT FROM OLD.details
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo se puede marcar el reporte como revisado'
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

COMMENT ON FUNCTION public.guard_comment_report() IS
  'Exige que el snapshot del reporte coincida con el comentario real al insertar y congela su contenido en updates: solo resolved/resolved_by/resolved_at cambian. Service role pasa libre.';

DROP TRIGGER IF EXISTS trigger_guard_comment_report ON public.comment_reports;
CREATE TRIGGER trigger_guard_comment_report
  BEFORE INSERT OR UPDATE ON public.comment_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_comment_report();

DROP POLICY IF EXISTS "comment_reports_insert_authenticated" ON public.comment_reports;
CREATE POLICY "comment_reports_insert_authenticated" ON public.comment_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = reporter_id
    AND resolved = false
    AND resolved_by IS NULL
    AND resolved_at IS NULL
  );

DROP POLICY IF EXISTS "comment_reports_read_admin" ON public.comment_reports;
CREATE POLICY "comment_reports_read_admin" ON public.comment_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "comment_reports_update_admin" ON public.comment_reports;
CREATE POLICY "comment_reports_update_admin" ON public.comment_reports
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
