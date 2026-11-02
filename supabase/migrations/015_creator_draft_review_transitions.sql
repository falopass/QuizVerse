-- 015 — El creador puede mover su quiz entre 'draft' y 'pending'
--
-- Problema: guard_quiz_editable_columns (014) restaura cualquier cambio de
-- `status` que no sea hacia 'archived' (o hecho por un admin). Eso cierra la
-- auto-publicación, pero también deja sin vía al flujo de borradores: la app
-- ahora deja "Guardar borrador" (status 'draft') y "Enviar a revisión"
-- (status 'pending'), y ambos escritos por JWT se revertían en silencio.
--
-- Solución: ampliar la lista de transiciones permitidas al creador:
--   * cualquier estado  -> 'archived'   (ya existía: despublicar/archivar)
--   * 'draft'   <-> 'pending'           (nuevo: enviar a revisión / retirar)
--
-- Lo que NO cambia:
--   * 'published' sigue exigiendo admin en guard_quiz_publication (010); esta
--     función además restaura el status antes de que esa guardia pueda siquiera
--     evaluarlo.
--   * 'rejected' y 'archived' no tienen salida por JWT de creador: el rechazo
--     lo resuelve la moderación y el archivo es terminal para el creador.
--   * El resto del guard (contadores, destacado, published_at, updated_at)
--     queda intacto, copiado de la 014.
--
-- Idempotente: CREATE OR REPLACE sobre la misma función; el trigger ya existe
-- desde la 014 y no se recrea.

CREATE OR REPLACE FUNCTION public.guard_quiz_editable_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mismo pase libre: service role, seeds, RPCs y triggers DEFINER
  -- (increment_plays, increment_shares, toggle_like, update_quiz_avg_score),
  -- y acciones FK.
  IF auth.uid() IS NULL OR current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Las estadisticas y el destacado editorial nacen en default en cualquier
    -- alta via PostgREST (createQuiz nunca los manda). El status NO se toca
    -- aqui: los 'published' sin admin ya los rechaza guard_quiz_publication.
    NEW.plays_count := 0;
    NEW.shares_count := 0;
    NEW.likes_count := 0;
    NEW.avg_score := 0;
    NEW.is_featured := false;
    NEW.featured_at := NULL;
    NEW.published_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE por JWT: identidad, estadisticas, destacado y sello editorial no
  -- se negocian. updated_at lo gestiona trg_quizzes_content_updated_at, que
  -- siempre lo reasigna (OLD o NOW): ningun cliente puede falsificarlo.
  NEW.id := OLD.id;
  NEW.creator_id := OLD.creator_id;
  NEW.plays_count := OLD.plays_count;
  NEW.shares_count := OLD.shares_count;
  NEW.likes_count := OLD.likes_count;
  NEW.avg_score := OLD.avg_score;
  NEW.is_featured := OLD.is_featured;
  NEW.featured_at := OLD.featured_at;
  NEW.published_at := OLD.published_at;
  NEW.is_ai_generated := OLD.is_ai_generated;
  NEW.created_at := OLD.created_at;

  -- status: la moderacion sigue siendo la unica via a 'published' (guard de
  -- la 010 y la clausula de admin aqui). El creador puede archivar su quiz
  -- desde cualquier estado y, desde la 015, moverlo entre 'draft' y
  -- 'pending' (enviar a revision / retirar a borrador). Editar un quiz
  -- publicado no lo re-modera: decision de producto pendiente, fuera de esta
  -- migracion.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       NEW.status = 'archived'
       OR (OLD.status = 'draft' AND NEW.status = 'pending')
       OR (OLD.status = 'pending' AND NEW.status = 'draft')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin
     )
  THEN
    NEW.status := OLD.status;
  END IF;

  -- Si tras las restauraciones la unica diferencia real es updated_at (p.ej.
  -- un PATCH que solo tocaba columnas protegidas), se revierte tambien: el
  -- lastmod del sitemap no debe moverse por una escritura que no cambio nada.
  IF (NEW.id, NEW.creator_id, NEW.category_id, NEW.title, NEW.slug,
      NEW.description, NEW.cover_image_url, NEW.quiz_type, NEW.difficulty,
      NEW.language, NEW.questions, NEW.results, NEW.tags,
      NEW.estimated_minutes, NEW.plays_count, NEW.shares_count, NEW.avg_score,
      NEW.likes_count, NEW.status, NEW.is_featured, NEW.is_ai_generated,
      NEW.featured_at, NEW.published_at, NEW.created_at)
     IS NOT DISTINCT FROM
     (OLD.id, OLD.creator_id, OLD.category_id, OLD.title, OLD.slug,
      OLD.description, OLD.cover_image_url, OLD.quiz_type, OLD.difficulty,
      OLD.language, OLD.questions, OLD.results, OLD.tags,
      OLD.estimated_minutes, OLD.plays_count, OLD.shares_count, OLD.avg_score,
      OLD.likes_count, OLD.status, OLD.is_featured, OLD.is_ai_generated,
      OLD.featured_at, OLD.published_at, OLD.created_at)
  THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_quiz_editable_columns() IS
  'Restaura columnas no editables de quizzes en escrituras con JWT (anon/authenticated): contadores, is_featured, published_at, status (salvo admin, archivo propio o draft<->pending desde la 015). Service role y triggers DEFINER pasan libre.';
