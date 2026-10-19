-- 011 — Lectura de quizzes propios en cualquier estado
--
-- Problema: `quizzes_public_read` (migración 002) deja al creador leer sus
-- filas solo en 'draft' o 'pending'; las 'published' las ve cualquiera. Un
-- quiz moderado a 'rejected' o 'archived' desaparece para su dueño: no sale
-- en /my-quizzes y `deleteQuiz` lo rechaza como 'forbidden', porque
-- `ownsQuiz` hace un SELECT de `creator_id` bajo la misma policy.
--
-- Solución: policy de lectura adicional por `creator_id`. Las policies
-- permisivas se combinan con OR, así que esta suma visibilidad sin tocar la
-- pública ni darle lectura a nadie más: en sesiones anónimas y service role
-- `auth.uid()` es NULL y la condición nunca se cumple.

CREATE POLICY "quizzes_creator_read" ON quizzes
  FOR SELECT
  USING (creator_id = auth.uid());
