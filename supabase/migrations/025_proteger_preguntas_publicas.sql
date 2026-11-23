-- 025_proteger_preguntas_publicas.sql
--
-- Cierre del hallazgo A-04 (respuestas y explicaciones visibles antes de elegir):
--
-- Problema:
--   * `toClientQuiz` y `015_ocultar_clave_respuestas.sql` usaban sustracción de
--     claves (`- 'explanation'`, `- 'is_correct'`) en lugar de una proyección
--     pública explícita por lista blanca.
--   * En actualizaciones parciales de preguntas sobre `quizzes` (cuando la
--     columna pública ya estaba saneada), reescribir `quiz_answer_keys` solo si
--     venía `is_correct` podía desincronizar el texto editado respecto de la
--     clave privada o perder explicaciones de trivia en re-importaciones.
--
-- Solución:
--   1. `public.project_public_quiz_questions(JSONB)`: construye una proyección
--      pública explícita por lista blanca (`id`, `question`, `image_url`,
--      `time_limit_seconds` y `options[]: { id, text, image_url, personality_tags }`),
--      excluyendo `explanation`, `is_correct` y cualquier atributo privado.
--   2. `public.merge_quiz_answer_key_questions(JSONB, JSONB)`: fusiona una
--      escritura entrante con la clave privada existente en `quiz_answer_keys`,
--      preservando `is_correct` y `explanation` por `(question.id, option.id)`
--      cuando la actualización entrante solo modifica campos públicos, y
--      actualizándolos cuando la entrada trae material de clave nuevo.
--   3. Backfill idempotente sobre `quiz_answer_keys` y `quizzes.questions` para
--      cubrir quizzes antiguos o importados antes del trigger sin pisar claves.
--   4. `public.split_quiz_answer_key()` actualizado para mantener sincronizada
--      la clave privada con explicaciones en cada INSERT o UPDATE de `questions`.

-- ============================================
-- 1. Tabla privada de claves y explicaciones
-- ============================================

CREATE TABLE IF NOT EXISTS public.quiz_answer_keys (
  quiz_id UUID PRIMARY KEY REFERENCES public.quizzes(id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  questions JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quiz_answer_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quiz_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quiz_answer_keys TO service_role;

-- ============================================
-- 2. Detección de material privado y proyección pública explícita
-- ============================================

CREATE OR REPLACE FUNCTION public.quiz_questions_have_key(p_questions JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_questions) = 'array' THEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_questions) AS q
      WHERE q.value ? 'explanation'
         OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(q.value -> 'options') = 'array'
                  THEN q.value -> 'options'
                  ELSE '[]'::jsonb
             END
           ) AS o
           WHERE o.value ? 'is_correct'
         )
    )
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.quiz_questions_have_key(JSONB) IS
  'Detecta si un questions JSONB contiene material privado (explanation a nivel pregunta o options[].is_correct).';

CREATE OR REPLACE FUNCTION public.project_public_quiz_questions(p_questions JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_questions) = 'array' THEN COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'id', q.value -> 'id',
              'question', q.value -> 'question',
              'image_url', CASE
                WHEN q.value ? 'image_url' AND jsonb_typeof(q.value -> 'image_url') <> 'null'
                THEN q.value -> 'image_url'
                ELSE NULL
              END,
              'time_limit_seconds', CASE
                WHEN q.value ? 'time_limit_seconds' AND jsonb_typeof(q.value -> 'time_limit_seconds') <> 'null'
                THEN q.value -> 'time_limit_seconds'
                ELSE NULL
              END,
              'options', CASE
                WHEN jsonb_typeof(q.value -> 'options') = 'array' THEN COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_strip_nulls(
                        jsonb_build_object(
                          'id', o.value -> 'id',
                          'text', o.value -> 'text',
                          'image_url', CASE
                            WHEN o.value ? 'image_url' AND jsonb_typeof(o.value -> 'image_url') <> 'null'
                            THEN o.value -> 'image_url'
                            ELSE NULL
                          END,
                          'personality_tags', CASE
                            WHEN o.value ? 'personality_tags' AND jsonb_typeof(o.value -> 'personality_tags') = 'array'
                            THEN o.value -> 'personality_tags'
                            ELSE NULL
                          END
                        )
                      )
                      ORDER BY o.ord
                    )
                    FROM jsonb_array_elements(q.value -> 'options') WITH ORDINALITY AS o(value, ord)
                  ),
                  '[]'::jsonb
                )
                ELSE '[]'::jsonb
              END
            )
          )
          ORDER BY q.ord
        )
        FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS q(value, ord)
      ),
      '[]'::jsonb
    )
    ELSE p_questions
  END;
$$;

COMMENT ON FUNCTION public.project_public_quiz_questions(JSONB) IS
  'Emite la proyección pública explícita de questions JSONB (sin explanation ni options[].is_correct). Idempotente.';

-- Mantiene el nombre histórico sanitize_quiz_questions delegando en la proyección explícita.
CREATE OR REPLACE FUNCTION public.sanitize_quiz_questions(p_questions JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.project_public_quiz_questions(p_questions);
$$;

COMMENT ON FUNCTION public.sanitize_quiz_questions(JSONB) IS
  'Alias compatible hacia project_public_quiz_questions(JSONB).';

-- ============================================
-- 3. Fusión segura de clave privada + explicaciones
-- ============================================

CREATE OR REPLACE FUNCTION public.merge_quiz_answer_key_questions(
  p_existing_key JSONB,
  p_incoming JSONB
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_incoming) <> 'array' THEN COALESCE(p_existing_key, p_incoming)
    WHEN p_existing_key IS NULL OR jsonb_typeof(p_existing_key) <> 'array' THEN p_incoming
    ELSE COALESCE(
      (
        SELECT jsonb_agg(
          (
            WITH existing_q AS (
              SELECT eq.value AS val
              FROM jsonb_array_elements(p_existing_key) AS eq
              WHERE eq.value ->> 'id' = iq.value ->> 'id'
              LIMIT 1
            ),
            merged_options AS (
              SELECT CASE
                WHEN jsonb_typeof(iq.value -> 'options') = 'array' THEN COALESCE(
                  (
                    SELECT jsonb_agg(
                      CASE
                        WHEN io.value ? 'is_correct' THEN io.value
                        WHEN EXISTS (
                          SELECT 1
                          FROM existing_q eq,
                               jsonb_array_elements(
                                 CASE WHEN jsonb_typeof(eq.val -> 'options') = 'array'
                                      THEN eq.val -> 'options'
                                      ELSE '[]'::jsonb
                                 END
                               ) AS eo
                          WHERE eo.value ->> 'id' = io.value ->> 'id'
                            AND eo.value ? 'is_correct'
                        ) THEN io.value || jsonb_build_object(
                          'is_correct',
                          (
                            SELECT eo.value -> 'is_correct'
                            FROM existing_q eq,
                                 jsonb_array_elements(eq.val -> 'options') AS eo
                            WHERE eo.value ->> 'id' = io.value ->> 'id'
                            LIMIT 1
                          )
                        )
                        ELSE io.value
                      END
                      ORDER BY io.ord
                    )
                    FROM jsonb_array_elements(iq.value -> 'options') WITH ORDINALITY AS io(value, ord)
                  ),
                  '[]'::jsonb
                )
                ELSE '[]'::jsonb
              END AS opts
            )
            SELECT (
              CASE
                WHEN iq.value ? 'explanation' AND jsonb_typeof(iq.value -> 'explanation') <> 'null'
                  THEN iq.value
                WHEN EXISTS (
                  SELECT 1 FROM existing_q eq
                  WHERE eq.val ? 'explanation' AND jsonb_typeof(eq.val -> 'explanation') <> 'null'
                ) THEN iq.value || jsonb_build_object(
                  'explanation',
                  (SELECT eq.val -> 'explanation' FROM existing_q eq LIMIT 1)
                )
                ELSE iq.value
              END
            ) || jsonb_build_object('options', (SELECT opts FROM merged_options))
          )
          ORDER BY iq.ord
        )
        FROM jsonb_array_elements(p_incoming) WITH ORDINALITY AS iq(value, ord)
      ),
      '[]'::jsonb
    )
  END;
$$;

COMMENT ON FUNCTION public.merge_quiz_answer_key_questions(JSONB, JSONB) IS
  'Fusiona questions entrantes con la clave privada previa sin perder explanation ni options[].is_correct.';

-- ============================================
-- 4. Backfill y sincronización por trigger
-- ============================================

INSERT INTO public.quiz_answer_keys (quiz_id, questions, updated_at)
SELECT q.id,
       public.merge_quiz_answer_key_questions(k.questions, q.questions),
       NOW()
FROM public.quizzes q
LEFT JOIN public.quiz_answer_keys k ON k.quiz_id = q.id
WHERE public.quiz_questions_have_key(q.questions)
   OR k.quiz_id IS NULL
ON CONFLICT (quiz_id) DO UPDATE
  SET questions = public.merge_quiz_answer_key_questions(public.quiz_answer_keys.questions, EXCLUDED.questions),
      updated_at = NOW()
  WHERE public.quiz_answer_keys.questions IS DISTINCT FROM
        public.merge_quiz_answer_key_questions(public.quiz_answer_keys.questions, EXCLUDED.questions);

UPDATE public.quizzes
SET questions = public.project_public_quiz_questions(questions)
WHERE questions IS DISTINCT FROM public.project_public_quiz_questions(questions);

CREATE OR REPLACE FUNCTION public.split_quiz_answer_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing JSONB;
  v_merged JSONB;
BEGIN
  SELECT k.questions INTO v_existing
  FROM public.quiz_answer_keys k
  WHERE k.quiz_id = NEW.id;

  IF public.quiz_questions_have_key(NEW.questions) OR v_existing IS NOT NULL THEN
    v_merged := public.merge_quiz_answer_key_questions(v_existing, NEW.questions);
    INSERT INTO public.quiz_answer_keys (quiz_id, questions, updated_at)
    VALUES (NEW.id, v_merged, NOW())
    ON CONFLICT (quiz_id) DO UPDATE
      SET questions = EXCLUDED.questions,
          updated_at = NOW()
      WHERE public.quiz_answer_keys.questions IS DISTINCT FROM EXCLUDED.questions;
  END IF;

  NEW.questions := public.project_public_quiz_questions(NEW.questions);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.split_quiz_answer_key() IS
  'Sincroniza questions completo (clave + explicaciones) en quiz_answer_keys y proyecta solo los campos públicos en quizzes.questions.';

REVOKE EXECUTE ON FUNCTION public.split_quiz_answer_key() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_split_quiz_answer_key ON public.quizzes;
CREATE TRIGGER trg_split_quiz_answer_key
  BEFORE INSERT OR UPDATE OF questions ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.split_quiz_answer_key();
