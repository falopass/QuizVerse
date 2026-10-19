-- 011_quizzes_content_updated_at.sql
-- `quizzes.updated_at` debe significar "cambió el contenido", no "hubo actividad".
-- Las funciones de engagement (increment_plays, increment_shares, toggle_like,
-- update_quiz_avg_score) hacen `SET updated_at = NOW()` en cada jugada, like o
-- share, y el sitemap consume esta columna para <lastmod>: cada partida marcaba
-- el quiz (y sus hubs) como modificado sin cambiar nada indexable.
--
-- Este BEFORE UPDATE corre después del SET del UPDATE: si solo cambiaron
-- contadores/estadísticas restaura OLD.updated_at; si cambió cualquier columna
-- de contenido/metadata pone NOW(). También cubre las ediciones de `updateQuiz`,
-- que no nombra updated_at en su payload.

CREATE OR REPLACE FUNCTION quizzes_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.title, NEW.slug, NEW.description, NEW.cover_image_url, NEW.quiz_type,
      NEW.difficulty, NEW.language, NEW.questions, NEW.results, NEW.tags,
      NEW.estimated_minutes, NEW.category_id, NEW.creator_id, NEW.status,
      NEW.is_featured, NEW.is_ai_generated, NEW.featured_at, NEW.published_at)
     IS DISTINCT FROM
     (OLD.title, OLD.slug, OLD.description, OLD.cover_image_url, OLD.quiz_type,
      OLD.difficulty, OLD.language, OLD.questions, OLD.results, OLD.tags,
      OLD.estimated_minutes, OLD.category_id, OLD.creator_id, OLD.status,
      OLD.is_featured, OLD.is_ai_generated, OLD.featured_at, OLD.published_at)
  THEN
    NEW.updated_at := NOW();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_quizzes_content_updated_at ON quizzes;
CREATE TRIGGER trg_quizzes_content_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION quizzes_content_updated_at();
