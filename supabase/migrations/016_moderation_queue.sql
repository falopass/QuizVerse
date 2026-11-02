-- 016 — Cola de moderación y evidencia de reportes
--
-- Tres cierres coordinados (hallazgos MOD-01, MOD-02 y MOD-03):
--
-- MOD-01 — Publicar o rechazar un quiz pendiente no era posible desde la app.
-- `guard_quiz_publication` (010) ya permite al admin llevar un quiz a
-- 'published', pero `quizzes_update_own` (002) solo deja actualizar al
-- creador: ninguna policy UPDATE alcanza al admin sobre quizzes ajenos.
-- Aquí se añade `quizzes_update_admin` (lectura ya la da
-- `quizzes_admin_read`, 012), las columnas de auditoría
-- (moderated_by/at/moderation_note) y un trigger que notifica al creador la
-- resolución — `notifications` no tiene policy INSERT para usuarios, así que
-- solo una función definer puede escribirla, igual que el resto del sistema.
--
-- MOD-02/03 — Borrar un quiz borraba sus reportes en cascada
-- (001_initial_schema.sql: ON DELETE CASCADE), así que el acusado destruía la
-- evidencia. Ahora `quiz_reports` conserva un snapshot (quiz_title/quiz_slug,
-- rellenado por trigger al crear el reporte) y la FK pasa a ON DELETE
-- SET NULL, así que aunque el quiz desaparezca el reporte queda con título y
-- slug. Además `guard_quiz_delete_with_reports` bloquea el DELETE del dueño
-- (por app o por PostgREST directo) mientras haya reportes sin resolver: la
-- app lo convierte en `status = 'archived'`. Service role (auth.uid() NULL)
-- borra libre para mantenimiento.
--
-- Idempotente: add column if not exists, drop/create policy y trigger,
-- create or replace de funciones. El código de la app funciona sin aplicarla:
-- publicar/rechazar falla con error controlado (RLS devuelve 0 filas) y
-- `deleteQuiz` borra como hoy al no recibir el ERRCODE del guard.

-- ============================================
-- Auditoría de moderación en quizzes
-- ============================================

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

-- ============================================
-- UPDATE admin sobre quizzes (moderación)
-- ============================================
-- Complementa `quizzes_admin_read` (012): el admin puede moderar quizzes
-- ajenos. `guard_quiz_publication` sigue exigiendo admin para publicar, así
-- que esta policy no abre nada a no-admins — su USING/WITH CHECK ya los deja
-- fuera. El trigger trg_quizzes_content_updated_at marca updated_at porque
-- status/publication_at son columnas de contenido (el sitemap lo agradece).

DROP POLICY IF EXISTS "quizzes_update_admin" ON public.quizzes;
CREATE POLICY "quizzes_update_admin" ON public.quizzes
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

-- ============================================
-- Notificación al creador al moderar
-- ============================================
-- Igual que notify_comment/notify_follow (007) pero SECURITY DEFINER: la
-- policy de notifications no permite INSERT a usuarios y el UPDATE lo firma
-- el admin — invoker rebotaría. Solo transiciones reales de estado; insertar
-- un quiz ya publicado no notifica (el admin que crea es su propio público).

CREATE OR REPLACE FUNCTION public.notify_quiz_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.creator_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'published' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.creator_id,
      'quiz_approved',
      'Your quiz was published',
      'Your quiz "' || NEW.title || '" is now live.',
      jsonb_build_object('quiz_id', NEW.id, 'slug', NEW.slug, 'language', NEW.language)
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.creator_id,
      'quiz_rejected',
      'Your quiz was rejected',
      'Your quiz "' || NEW.title || '" was rejected.' ||
        CASE WHEN NEW.moderation_note IS NOT NULL AND NEW.moderation_note <> ''
             THEN ' Reason: ' || NEW.moderation_note ELSE '' END,
      jsonb_build_object('quiz_id', NEW.id, 'slug', NEW.slug,
                         'moderation_note', NEW.moderation_note)
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_quiz_moderation() IS
  'Emite quiz_approved/quiz_rejected al creador cuando cambia el status del quiz. Definer: notifications no admite INSERT por policy.';

DROP TRIGGER IF EXISTS trg_notify_quiz_moderation ON public.quizzes;
CREATE TRIGGER trg_notify_quiz_moderation
  AFTER UPDATE OF status ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_quiz_moderation();

-- ============================================
-- Evidencia de reportes: snapshot + SET NULL
-- ============================================

ALTER TABLE public.quiz_reports
  ADD COLUMN IF NOT EXISTS quiz_title TEXT,
  ADD COLUMN IF NOT EXISTS quiz_slug TEXT;

-- El snapshot lo rellena la base al crear el reporte: funciona para inserts de
-- anónimos (que a lo mejor ni leen el quiz) y para inserts directos por SQL.
CREATE OR REPLACE FUNCTION public.quiz_reports_fill_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.quiz_id IS NOT NULL AND NEW.quiz_title IS NULL THEN
    SELECT title, slug INTO NEW.quiz_title, NEW.quiz_slug
    FROM public.quizzes
    WHERE id = NEW.quiz_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_reports_snapshot ON public.quiz_reports;
CREATE TRIGGER trg_quiz_reports_snapshot
  BEFORE INSERT ON public.quiz_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.quiz_reports_fill_snapshot();

-- Backfill: los reportes ya creados también se acoplan al snapshot.
UPDATE public.quiz_reports r
SET quiz_title = q.title, quiz_slug = q.slug
FROM public.quizzes q
WHERE r.quiz_id = q.id AND r.quiz_title IS NULL;

-- SET NULL: borrar el quiz ya no se lleva el reporte. quiz_id pasa a nullable.
ALTER TABLE public.quiz_reports ALTER COLUMN quiz_id DROP NOT NULL;
ALTER TABLE public.quiz_reports DROP CONSTRAINT IF EXISTS quiz_reports_quiz_id_fkey;
ALTER TABLE public.quiz_reports
  ADD CONSTRAINT quiz_reports_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE SET NULL;

-- ============================================
-- Borrado con reportes abiertos → la app archiva
-- ============================================
-- Un quiz con reportes sin resolver ES la evidencia: el dueño no puede
-- borrarlo ni por la app ni por PostgREST directo (quizzes_delete_own se lo
-- permitiría). El código de error QVM03 lo reconoce deleteQuiz para archivar
-- en su lugar. Service role y mantenimiento (auth.uid() NULL) pasan libres.

CREATE OR REPLACE FUNCTION public.guard_quiz_delete_with_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_reports
    WHERE quiz_id = OLD.id AND resolved = false
  ) THEN
    RAISE EXCEPTION 'El quiz tiene reportes abiertos: se archiva en vez de borrarse'
      USING ERRCODE = 'QVM03';
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.guard_quiz_delete_with_reports() IS
  'Bloquea DELETE de quizzes con reportes sin resolver (ERRCODE QVM03): la app archiva. Service role pasa libre.';

DROP TRIGGER IF EXISTS trg_guard_quiz_delete_with_reports ON public.quizzes;
CREATE TRIGGER trg_guard_quiz_delete_with_reports
  BEFORE DELETE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quiz_delete_with_reports();
