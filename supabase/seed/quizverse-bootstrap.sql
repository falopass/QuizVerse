-- QuizVerse bootstrap for a fresh Supabase project
-- Safe to run in the Supabase SQL Editor.

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_type') THEN
    CREATE TYPE quiz_type AS ENUM ('trivia', 'personality', 'poll');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_status') THEN
    CREATE TYPE quiz_status AS ENUM ('draft', 'pending', 'published', 'rejected', 'archived');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty') THEN
    CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE report_reason AS ENUM (
      'inappropriate',
      'spam',
      'incorrect_info',
      'hate_speech',
      'copyright',
      'other'
    );
  END IF;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 280),
  points INTEGER DEFAULT 0 NOT NULL,
  quizzes_played INTEGER DEFAULT 0 NOT NULL,
  quizzes_created INTEGER DEFAULT 0 NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,24}$')
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  gradient_from TEXT,
  gradient_to TEXT,
  quiz_count INTEGER DEFAULT 0 NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  slug TEXT UNIQUE NOT NULL,
  description TEXT CHECK (char_length(description) <= 300),
  cover_image_url TEXT,
  quiz_type quiz_type NOT NULL DEFAULT 'trivia',
  difficulty difficulty DEFAULT 'medium',
  language TEXT NOT NULL DEFAULT 'en',
  questions JSONB NOT NULL,
  results JSONB,
  tags TEXT[] DEFAULT '{}',
  estimated_minutes INTEGER DEFAULT 3,
  question_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(questions)) STORED,
  plays_count INTEGER DEFAULT 0 NOT NULL,
  shares_count INTEGER DEFAULT 0 NOT NULL,
  avg_score NUMERIC(5,2) DEFAULT 0,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  status quiz_status DEFAULT 'draft' NOT NULL,
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE NOT NULL,
  featured_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL,
  percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN max_score > 0 THEN (score::NUMERIC / max_score * 100) ELSE 0 END
  ) STORED,
  result_id TEXT,
  result_title TEXT,
  time_taken_seconds INTEGER,
  answers JSONB,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  was_shared BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_likes (
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (quiz_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  details TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  points_reward INTEGER DEFAULT 0,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_slug ON public.quizzes(slug);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_quizzes_category ON public.quizzes(category_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_quizzes_language ON public.quizzes(language) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_quizzes_featured ON public.quizzes(is_featured, featured_at DESC) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_quizzes_popular ON public.quizzes(plays_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_quizzes_recent ON public.quizzes(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_quizzes_tags ON public.quizzes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_quizzes_search ON public.quizzes USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_quizzes_title_trgm ON public.quizzes USING GIN(title gin_trgm_ops) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_sessions_quiz ON public.game_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON public.game_sessions(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON public.game_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "quizzes_public_read" ON public.quizzes;
CREATE POLICY "quizzes_public_read" ON public.quizzes
  FOR SELECT
  USING (
    status = 'published' OR
    (status = 'draft' AND creator_id = auth.uid()) OR
    (status = 'pending' AND creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "quizzes_insert_authenticated" ON public.quizzes;
CREATE POLICY "quizzes_insert_authenticated" ON public.quizzes
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "quizzes_update_own" ON public.quizzes;
CREATE POLICY "quizzes_update_own" ON public.quizzes
  FOR UPDATE
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "quizzes_delete_own" ON public.quizzes;
CREATE POLICY "quizzes_delete_own" ON public.quizzes
  FOR DELETE
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "game_sessions_insert_any" ON public.game_sessions;
CREATE POLICY "game_sessions_insert_any" ON public.game_sessions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "game_sessions_read" ON public.game_sessions;
CREATE POLICY "game_sessions_read" ON public.game_sessions
  FOR SELECT
  USING (
    player_id = auth.uid() OR
    player_id IS NULL OR
    share_token IS NOT NULL
  );

DROP POLICY IF EXISTS "quiz_likes_public_read" ON public.quiz_likes;
CREATE POLICY "quiz_likes_public_read" ON public.quiz_likes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "quiz_likes_insert_own" ON public.quiz_likes;
CREATE POLICY "quiz_likes_insert_own" ON public.quiz_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_likes_delete_own" ON public.quiz_likes;
CREATE POLICY "quiz_likes_delete_own" ON public.quiz_likes
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_reports_read_authenticated" ON public.quiz_reports;
CREATE POLICY "quiz_reports_read_authenticated" ON public.quiz_reports
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quiz_reports_insert_authenticated" ON public.quiz_reports;
CREATE POLICY "quiz_reports_insert_authenticated" ON public.quiz_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

DROP POLICY IF EXISTS "quiz_reports_update_admin" ON public.quiz_reports;
CREATE POLICY "quiz_reports_update_admin" ON public.quiz_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "user_achievements_read_own" ON public.user_achievements;
CREATE POLICY "user_achievements_read_own" ON public.user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_achievements_insert_system" ON public.user_achievements;
CREATE POLICY "user_achievements_insert_system" ON public.user_achievements
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "categories_admin_manage" ON public.categories;
CREATE POLICY "categories_admin_manage" ON public.categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "achievements_public_read" ON public.achievements;
CREATE POLICY "achievements_public_read" ON public.achievements
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "achievements_admin_manage" ON public.achievements;
CREATE POLICY "achievements_admin_manage" ON public.achievements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Functions
CREATE OR REPLACE FUNCTION public.increment_plays(quiz_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.quizzes
  SET plays_count = plays_count + 1,
      updated_at = NOW()
  WHERE id = quiz_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_shares(quiz_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.quizzes
  SET shares_count = shares_count + 1,
      updated_at = NOW()
  WHERE id = quiz_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.toggle_like(p_quiz_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  already_liked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_likes
    WHERE quiz_id = p_quiz_id AND user_id = p_user_id
  ) INTO already_liked;

  IF already_liked THEN
    DELETE FROM public.quiz_likes
    WHERE quiz_id = p_quiz_id AND user_id = p_user_id;

    UPDATE public.quizzes
    SET likes_count = GREATEST(likes_count - 1, 0),
        updated_at = NOW()
    WHERE id = p_quiz_id;

    RETURN FALSE;
  END IF;

  INSERT INTO public.quiz_likes (quiz_id, user_id)
  VALUES (p_quiz_id, p_user_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.quizzes
  SET likes_count = likes_count + 1,
      updated_at = NOW()
  WHERE id = p_quiz_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_quiz_avg_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.quizzes
  SET avg_score = (
    SELECT AVG(percentage)
    FROM public.game_sessions
    WHERE quiz_id = NEW.quiz_id
  ),
  updated_at = NOW()
  WHERE id = NEW.quiz_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'name', 'user_' || LEFT(NEW.id::TEXT, 8)), ' ', '_')),
    COALESCE(NEW.raw_user_meta_data->>'name', 'New Player'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_category_quiz_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.categories
      SET quiz_count = quiz_count + 1
      WHERE id = NEW.category_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL AND OLD.status = 'published' THEN
      UPDATE public.categories
      SET quiz_count = GREATEST(quiz_count - 1, 0)
      WHERE id = OLD.category_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.category_id IS NOT NULL AND OLD.status = 'published' AND (
      OLD.category_id IS DISTINCT FROM NEW.category_id OR NEW.status <> 'published'
    ) THEN
      UPDATE public.categories
      SET quiz_count = GREATEST(quiz_count - 1, 0)
      WHERE id = OLD.category_id;
    END IF;

    IF NEW.category_id IS NOT NULL AND NEW.status = 'published' AND (
      OLD.category_id IS DISTINCT FROM NEW.category_id OR OLD.status <> 'published'
    ) THEN
      UPDATE public.categories
      SET quiz_count = quiz_count + 1
      WHERE id = NEW.category_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.award_quiz_points()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER := 10;
BEGIN
  IF NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.max_score > 0 AND NEW.score = NEW.max_score THEN
    points_earned := points_earned + 25;
  END IF;

  UPDATE public.profiles
  SET points = points + points_earned,
      quizzes_played = quizzes_played + 1,
      updated_at = NOW()
  WHERE id = NEW.player_id;

  -- Los logros los desbloquea checkAchievements() en la app (ver migracion 011):
  -- el trigger solo lleva puntos y contadores.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_creator_quizzes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.creator_id IS NOT NULL AND NEW.status = 'published' THEN
      UPDATE public.profiles
      SET quizzes_created = quizzes_created + 1,
          updated_at = NOW()
      WHERE id = NEW.creator_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.creator_id IS NOT NULL AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
      UPDATE public.profiles
      SET quizzes_created = quizzes_created + 1,
          updated_at = NOW()
      WHERE id = NEW.creator_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_old_game_sessions()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.game_sessions
  WHERE completed_at < NOW() - INTERVAL '90 days'
    AND player_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_update_avg_score ON public.game_sessions;
CREATE TRIGGER trigger_update_avg_score
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quiz_avg_score();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trigger_update_category_quiz_count ON public.quizzes;
CREATE TRIGGER trigger_update_category_quiz_count
  AFTER INSERT OR UPDATE OR DELETE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_category_quiz_count();

DROP TRIGGER IF EXISTS trigger_award_quiz_points ON public.game_sessions;
CREATE TRIGGER trigger_award_quiz_points
  AFTER INSERT ON public.game_sessions
  FOR EACH ROW
  WHEN (NEW.player_id IS NOT NULL)
  EXECUTE FUNCTION public.award_quiz_points();

DROP TRIGGER IF EXISTS trigger_increment_creator_quizzes ON public.quizzes;
CREATE TRIGGER trigger_increment_creator_quizzes
  AFTER INSERT OR UPDATE ON public.quizzes
  FOR EACH ROW
  WHEN (NEW.status = 'published')
  EXECUTE FUNCTION public.increment_creator_quizzes();

-- Launch categories aligned with the current frontend
INSERT INTO public.categories (name, slug, description, icon, color, gradient_from, gradient_to, sort_order)
VALUES
  ('Personality', 'personality', 'Quizzes about taste, instincts, relationships and self-discovery.', 'P', '#d87834', '#d87834', '#7d5f4f', 1),
  ('Trivia', 'trivia', 'Fast knowledge rounds with polished pacing and clean reveals.', 'T', '#1f6feb', '#1f6feb', '#37b4ff', 2),
  ('Culture', 'culture', 'Cinema, music, internet, books and modern shared references.', 'C', '#7c3aed', '#7c3aed', '#b16eff', 3),
  ('Lifestyle', 'lifestyle', 'Coffee, routines, travel, work style and everyday rituals.', 'L', '#0f9d58', '#0f9d58', '#7cd992', 4)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  gradient_from = EXCLUDED.gradient_from,
  gradient_to = EXCLUDED.gradient_to,
  sort_order = EXCLUDED.sort_order;

-- Base achievements
INSERT INTO public.achievements (id, name, description, icon, points_reward, condition_type, condition_value)
VALUES
  ('first_quiz', 'First Steps', 'Complete your first quiz', 'target', 10, 'plays', 1),
  ('quiz_addict_10', 'Quiz Addict', 'Complete 10 quizzes', 'flame', 50, 'plays', 10),
  ('quiz_master_50', 'Quiz Master', 'Complete 50 quizzes', 'crown', 150, 'plays', 50),
  ('perfect_score', 'Flawless', 'Get a perfect score on any quiz', 'diamond', 25, 'score', 100),
  ('creator', 'Quiz Creator', 'Create your first quiz', 'pencil', 30, 'creates', 1),
  ('going_viral', 'Going Viral', 'Your quiz reaches 100 plays', 'rocket', 50, 'shares', 100),
  ('internet_famous', 'Internet Famous', 'Your quiz reaches 1000 plays', 'star', 200, 'shares', 1000),
  ('week_streak', 'Streak Master', 'Play quizzes 7 days in a row', 'calendar', 50, 'streak', 7),
  ('explorer', 'Explorer', 'Play quizzes from 5 different categories', 'map', 75, 'categories', 5),
  ('social_butterfly', 'Social Butterfly', 'Share 10 quiz results', 'share', 40, 'shares', 10)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  points_reward = EXCLUDED.points_reward,
  condition_type = EXCLUDED.condition_type,
  condition_value = EXCLUDED.condition_value;

COMMIT;
