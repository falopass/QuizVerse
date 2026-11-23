-- 030_permitir_edicion_preguntas_borrador.sql
--
-- L5 — Edición de preguntas y resultados solo en borradores propios.
--
-- Problema:
--   1. `guard_published_quiz_key` (015_ocultar_clave_respuestas.sql) solo
--      rechazaba cambios de `questions`/`results` cuando `OLD.status = 'published'`,
--      dejando abierta la mutación directa en `pending`, `rejected` y `archived`.
--   2. Bajo la 015, `quizzes.questions` está saneado (sin `is_correct` ni
--      `explanation`) y `quiz_answer_keys` no concede SELECT a `authenticated`.
--      Para editar su propio borrador de trivia sin abrir `quiz_answer_keys`,
--      el creador necesita una vía estrictamente acotada a `creator_id = auth.uid()`
--      y `status = 'draft'`.
--
-- Solución:
--   1. Endurecer `public.guard_published_quiz_key()` para que un JWT no-admin
--      solo pueda modificar `questions` o `results` mientras `OLD.status = 'draft'`.
--      Cualquier otro estado (`pending`, `published`, `rejected`, `archived`)
--      levanta `42501`. Al editar un borrador, `trg_split_quiz_answer_key` (015)
--      sigue sincronizando `quiz_answer_keys` y saneando `quizzes.questions` en
--      la misma operación, y `question_count` se recalcula automáticamente por
--      ser columna GENERATED ALWAYS.
--   2. Exponer `public.get_own_draft_questions(p_quiz_id UUID)` como función
--      SECURITY DEFINER concedida únicamente a `authenticated`: devuelve el JSONB
--      completo de preguntas (`quiz_answer_keys.questions` si existe, si no
--      `quizzes.questions`) ÚNICAMENTE si el quiz pertenece a `auth.uid()` y está
--      en `status = 'draft'`. Nunca devuelve claves de quizzes publicados,
--      pendientes, rechazados, archivados ni ajenos.
--
-- Compatibilidad:
--   * El runtime (`src/actions/quiz.actions.ts`) funciona con esta migración
--     aplicada y sin aplicar: usa `service_role` cuando está configurado y
--     recurre a esta RPC cuando falta, validando propiedad y `status = 'draft'`
--     en servidor en ambos casos.
--   * No concede ningún privilegio nuevo sobre `public.quiz_answer_keys`.
--
-- Idempotente: CREATE OR REPLACE FUNCTION + REVOKE/GRANT repetibles.

-- ============================================
-- 1. Restringir edición de questions/results a borradores propios (o admin)
-- ============================================

CREATE OR REPLACE FUNCTION public.guard_published_quiz_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'draft'
     AND (NEW.questions IS DISTINCT FROM OLD.questions
          OR NEW.results IS DISTINCT FROM OLD.results)
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin
     )
  THEN
    RAISE EXCEPTION 'Solo se pueden editar preguntas o resultados en borradores propios'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_published_quiz_key() IS
  'Rechaza UPDATE de questions/results hecho con JWT de no-admin cuando el quiz no está en status = draft (030). Service role y admins conservan acceso.';

REVOKE EXECUTE ON FUNCTION public.guard_published_quiz_key() FROM PUBLIC;

-- ============================================
-- 2. Lectura acotada de preguntas de un borrador propio (incluyendo clave)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_own_draft_questions(p_quiz_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_questions JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(k.questions, q.questions)
  INTO v_questions
  FROM public.quizzes q
  LEFT JOIN public.quiz_answer_keys k ON k.quiz_id = q.id
  WHERE q.id = p_quiz_id
    AND q.creator_id = auth.uid()
    AND q.status = 'draft';

  RETURN v_questions;
END;
$$;

COMMENT ON FUNCTION public.get_own_draft_questions(UUID) IS
  'Devuelve las preguntas completas (con clave de trivia) únicamente para un borrador (status = draft) cuyo creator_id coincide con auth.uid(). Nunca expone quiz_answer_keys para otros estados o dueños.';

REVOKE ALL ON FUNCTION public.get_own_draft_questions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_draft_questions(UUID) TO authenticated, service_role;
