-- ============================================
-- QUIZVERSE FUNCTIONS AND TRIGGERS
-- Migration 003: Database Functions
-- ============================================

-- ============================================
-- FUNCIONES DE UTILIDAD
-- ============================================

-- Incrementar plays de un quiz (atómico)
CREATE OR REPLACE FUNCTION increment_plays(quiz_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE quizzes
  SET plays_count = plays_count + 1,
      updated_at = NOW()
  WHERE id = quiz_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Incrementar shares
CREATE OR REPLACE FUNCTION increment_shares(quiz_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE quizzes
  SET shares_count = shares_count + 1
  WHERE id = quiz_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle like (insert o delete)
CREATE OR REPLACE FUNCTION toggle_like(p_quiz_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  already_liked BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM quiz_likes
    WHERE quiz_id = p_quiz_id AND user_id = p_user_id
  ) INTO already_liked;

  IF already_liked THEN
    DELETE FROM quiz_likes
    WHERE quiz_id = p_quiz_id AND user_id = p_user_id;
    UPDATE quizzes SET likes_count = likes_count - 1 WHERE id = p_quiz_id;
    RETURN FALSE;
  ELSE
    INSERT INTO quiz_likes (quiz_id, user_id) VALUES (p_quiz_id, p_user_id);
    UPDATE quizzes SET likes_count = likes_count + 1 WHERE id = p_quiz_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar avg_score después de cada partida
CREATE OR REPLACE FUNCTION update_quiz_avg_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quizzes
  SET avg_score = (
    SELECT AVG(percentage)
    FROM game_sessions
    WHERE quiz_id = NEW.quiz_id
  )
  WHERE id = NEW.quiz_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_avg_score
  AFTER INSERT ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_avg_score();

-- ============================================
-- AUTO-CREAR PERFIL AL REGISTRARSE
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'name', 'user_' || LEFT(NEW.id::TEXT, 8)), ' ', '_')),
    COALESCE(NEW.raw_user_meta_data->>'name', 'New Player'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ACTUALIZAR QUIZ_COUNT EN CATEGORÍAS
-- ============================================

CREATE OR REPLACE FUNCTION update_category_quiz_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrementar o decrementar según la operación
  IF TG_OP = 'INSERT' THEN
    UPDATE categories
    SET quiz_count = quiz_count + 1
    WHERE id = NEW.category_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE categories
    SET quiz_count = quiz_count - 1
    WHERE id = OLD.category_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió de categoría
    IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      IF OLD.category_id IS NOT NULL THEN
        UPDATE categories
        SET quiz_count = quiz_count - 1
        WHERE id = OLD.category_id;
      END IF;
      IF NEW.category_id IS NOT NULL THEN
        UPDATE categories
        SET quiz_count = quiz_count + 1
        WHERE id = NEW.category_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_quiz_count
  AFTER INSERT OR UPDATE OR DELETE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_category_quiz_count();

-- ============================================
-- ACTUALIZAR PUNTOS DEL USUARIO
-- ============================================

-- Función para actualizar puntos cuando se completa un quiz
CREATE OR REPLACE FUNCTION award_quiz_points()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER := 10;  -- Base points for completing a quiz
  is_perfect_score BOOLEAN := FALSE;
BEGIN
  -- Bonus por puntaje perfecto en trivia
  IF NEW.max_score > 0 AND NEW.score = NEW.max_score THEN
    points_earned := points_earned + 25;
    is_perfect_score := TRUE;
  END IF;

  -- Actualizar puntos del jugador
  UPDATE profiles
  SET points = points + points_earned,
      quizzes_played = quizzes_played + 1
  WHERE id = NEW.player_id;

  -- Check y award de achievements
  -- First quiz
  IF (SELECT quizzes_played FROM profiles WHERE id = NEW.player_id) = 1 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT NEW.player_id, 'first_quiz'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;

    -- Award points for achievement
    UPDATE profiles
    SET points = points + COALESCE((SELECT points_reward FROM achievements WHERE id = 'first_quiz'), 0)
    WHERE id = NEW.player_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_award_quiz_points
  AFTER INSERT ON game_sessions
  FOR EACH ROW
  WHEN (NEW.player_id IS NOT NULL)
  EXECUTE FUNCTION award_quiz_points();

-- ============================================
-- ACTUALIZAR QUIZZES_CREATED DEL CREADOR
-- ============================================

CREATE OR REPLACE FUNCTION increment_creator_quizzes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    UPDATE profiles
    SET quizzes_created = quizzes_created + 1
    WHERE id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_creator_quizzes
  AFTER INSERT OR UPDATE ON quizzes
  FOR EACH ROW
  WHEN (NEW.status = 'published')
  EXECUTE FUNCTION increment_creator_quizzes();

-- ============================================
-- CLEANUP DE SESIONES ANTIGUAS (opcional)
-- ============================================

-- Función para limpiar game_sessions antiguas (más de 90 días)
-- Se puede ejecutar manualmente o con pg_cron
CREATE OR REPLACE FUNCTION cleanup_old_game_sessions()
RETURNS VOID AS $$
BEGIN
  DELETE FROM game_sessions
  WHERE completed_at < NOW() - INTERVAL '90 days'
  AND player_id IS NULL;  -- Solo sesiones anónimas
END;
$$ LANGUAGE plpgsql;
