-- 015_ocultar_clave_respuestas.sql
--
-- AB-01 — La clave de respuestas era legible por la API pública:
--   GET /rest/v1/quizzes?select=id,slug,questions&status=eq.published
-- con la publishable key devolvía options[].is_correct y explanation. Todo el
-- andamiaje server-authoritative (toClientQuiz, /api/quiz/reveal) quedaba
-- anulado: la clave salía directo de PostgREST.
--
-- Diseño — tabla de claves en vez de columna espejo:
--   La alternativa era una columna questions_public saneada + REVOKE SELECT
--   (questions). Eso exigía rescribir cada select('*') del código con listas
--   explícitas y reintentos por "columna inexistente" mientras la migración no
--   estuviera aplicada, y cualquier select('*') olvidado rompería la página el
--   día que se aplicara. En su lugar la clave se MUDA a
--   public.quiz_answer_keys — tabla sin grants ni policies para
--   anon/authenticated — y quizzes.questions queda saneado en sitio. Todos los
--   select('*') existentes siguen funcionando igual y devuelven solo lo
--   público; un select futuro tampoco puede reabrir la fuga, porque ya no hay
--   secreto en la tabla que anon lee.
--
-- Mantenimiento — trigger BEFORE INSERT OR UPDATE OF questions:
--   copia la versión cruda a quiz_answer_keys y sanea la columna pública.
--   Las altas de creadores, la generación AI y los seeds editoriales escriben
--   questions como siempre y la clave se guarda sola.
--
-- Sobre el resto del hallazgo:
--   * correct_answers no existe en el esquema (la clave vive dentro de
--     questions): no hay nada más que revocar.
--   * game_sessions.answers guarda veredictos por jugador (is_correct de la
--     opción ELEGIDA, no la opción correcta): con la 013 solo se lee la
--     sesión propia o por share_token, y la página /result ya muestra la
--     respuesta correcta de cada pregunta respondida — por diseño — así que
--     no revela nada que la propia pantalla no enseñe. Sin cambios.
--   * personality_tags quedan públicos en questions: hoy ya viajan al
--     cliente vía toClientQuiz y no afectan puntos ni logros. Lo que sale de
--     la columna pública es solo is_correct y explanation.
--
-- ORDEN DE DESPLIEGUE — el Worker necesita SUPABASE_SERVICE_ROLE_KEY para
-- leer quiz_answer_keys. Aplicar DESPUÉS de configurar el secreto y del
-- redeploy: sin la key, el runtime no puede leer la clave y los quizzes
-- trivia dejarían de puntuar (el código lo detecta y lo grita en logs; no
-- entrega partidas vacías). El catálogo, /play y los personality quizzes
-- funcionan igual en cualquier orden, porque su contenido sigue completo en
-- la columna pública.
--
-- Idempotente: CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS, y el
-- backfill solo toca filas que aún traen material de clave.

-- ============================================
-- 1. La clave vive en su propia tabla, fuera del alcance de anon/authenticated
-- ============================================

CREATE TABLE IF NOT EXISTS public.quiz_answer_keys (
  quiz_id UUID PRIMARY KEY REFERENCES public.quizzes(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS sin policies: ni anon ni authenticated leen fila alguna; service_role
-- salta RLS pero igual necesita privilegio, así que el grant es explícito.
ALTER TABLE public.quiz_answer_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quiz_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quiz_answer_keys TO service_role;

-- ============================================
-- 2. Funciones: detección de material secreto y saneado
-- ============================================

-- TRUE si el jsonb trae algo que no debe ser público: explanation a nivel
-- pregunta o is_correct dentro de alguna opción. Los personality quizzes
-- suelen no tener ninguna de las dos (su "clave" son los personality_tags,
-- que son públicos) y para ellos el saneado es un no-op.
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
  'Detecta si un questions JSONB todavía contiene material de clave (explanation o options[].is_correct).';

-- Devuelve el mismo array sin explanation ni options[].is_correct. Idempotente
-- por construcción: aplicarlo dos veces da el mismo resultado.
CREATE OR REPLACE FUNCTION public.sanitize_quiz_questions(p_questions JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_questions) = 'array' THEN COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(q.value -> 'options') = 'array' THEN jsonb_set(
              q.value - 'explanation',
              '{options}',
              (
                SELECT jsonb_agg(o.value - 'is_correct')
                FROM jsonb_array_elements(q.value -> 'options') AS o
              )
            )
            ELSE q.value - 'explanation'
          END
        )
        FROM jsonb_array_elements(p_questions) AS q
      ),
      '[]'::jsonb
    )
    ELSE p_questions
  END;
$$;

COMMENT ON FUNCTION public.sanitize_quiz_questions(JSONB) IS
  'Quita explanation y options[].is_correct de un questions JSONB. Idempotente.';

-- ============================================
-- 3. Backfill: la clave se copia ANTES de sanear la columna pública
-- ============================================

-- Solo filas que aún tienen clave: en una re-ejecución el WHERE no encuentra
-- nada y quiz_answer_keys conserva lo que ya tiene — jamás se pisa la clave
-- con la versión saneada.
INSERT INTO public.quiz_answer_keys (quiz_id, questions, updated_at)
SELECT id, questions, NOW()
FROM public.quizzes
WHERE public.quiz_questions_have_key(questions)
ON CONFLICT (quiz_id) DO UPDATE
  SET questions = EXCLUDED.questions,
      updated_at = NOW();

UPDATE public.quizzes
SET questions = public.sanitize_quiz_questions(questions)
WHERE public.quiz_questions_have_key(questions);

-- ============================================
-- 4. Trigger: cada escritura de questions divide clave y versión pública
-- ============================================

-- Corre como definer: escribe quiz_answer_keys aunque el INSERT/UPDATE lo
-- haga un usuario sin grants sobre esa tabla. El guard usa NEW.questions —
-- que es lo que el llamador mandó — así que una escritura ya saneada (re-run
-- del backfill, mantenimiento) no pisa la clave guardada con basura.
CREATE OR REPLACE FUNCTION public.split_quiz_answer_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.quiz_questions_have_key(NEW.questions) THEN
    INSERT INTO public.quiz_answer_keys (quiz_id, questions, updated_at)
    VALUES (NEW.id, NEW.questions, NOW())
    ON CONFLICT (quiz_id) DO UPDATE
      SET questions = EXCLUDED.questions,
          updated_at = NOW();
  END IF;
  NEW.questions := public.sanitize_quiz_questions(NEW.questions);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.split_quiz_answer_key() IS
  'Copia questions crudo a quiz_answer_keys y deja la columna pública saneada.';

REVOKE EXECUTE ON FUNCTION public.split_quiz_answer_key() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_split_quiz_answer_key ON public.quizzes;
CREATE TRIGGER trg_split_quiz_answer_key
  BEFORE INSERT OR UPDATE OF questions ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.split_quiz_answer_key();
