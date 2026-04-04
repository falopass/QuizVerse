-- ============================================
-- QUIZVERSE DATABASE SCHEMA
-- Supabase PostgreSQL
-- Migration 001: Initial Schema
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para búsqueda fuzzy

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE quiz_type AS ENUM (
  'trivia',        -- Respuestas correctas/incorrectas con puntaje
  'personality',   -- Sin respuestas correctas, resultado basado en perfil
  'poll'           -- Votación, sin puntaje
);

CREATE TYPE quiz_status AS ENUM (
  'draft',         -- Solo visible para el creador
  'pending',       -- Esperando moderación (UGC)
  'published',     -- Visible públicamente e indexado
  'rejected',      -- Rechazado por moderación
  'archived'       -- Archivado por el creador o admin
);

CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');

CREATE TYPE report_reason AS ENUM (
  'inappropriate',
  'spam',
  'incorrect_info',
  'hate_speech',
  'copyright',
  'other'
);

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

-- Perfiles de usuario (extiende auth.users de Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 280),
  points INTEGER DEFAULT 0 NOT NULL,
  quizzes_played INTEGER DEFAULT 0 NOT NULL,
  quizzes_created INTEGER DEFAULT 0 NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,  -- Creadores verificados
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,24}$')
);

-- Categorías de quizzes
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,                -- Emoji o nombre de icono
  color TEXT,               -- Color hex para UI
  gradient_from TEXT,       -- Gradiente CSS start
  gradient_to TEXT,         -- Gradiente CSS end
  quiz_count INTEGER DEFAULT 0 NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Quizzes
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Contenido
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  slug TEXT UNIQUE NOT NULL,
  description TEXT CHECK (char_length(description) <= 300),
  cover_image_url TEXT,
  quiz_type quiz_type NOT NULL DEFAULT 'trivia',
  difficulty difficulty DEFAULT 'medium',
  language TEXT NOT NULL DEFAULT 'en',

  -- Preguntas almacenadas como JSONB
  questions JSONB NOT NULL,

  -- Resultados posibles (para personality quizzes)
  results JSONB,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  estimated_minutes INTEGER DEFAULT 3,
  question_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(questions)) STORED,

  -- Stats (denormalizados para rendimiento)
  plays_count INTEGER DEFAULT 0 NOT NULL,
  shares_count INTEGER DEFAULT 0 NOT NULL,
  avg_score NUMERIC(5,2) DEFAULT 0,
  likes_count INTEGER DEFAULT 0 NOT NULL,

  -- Control
  status quiz_status DEFAULT 'draft' NOT NULL,
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE NOT NULL,
  featured_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Resultados de partidas (cada vez que alguien juega un quiz)
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = anónimo

  -- Resultado
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL,
  percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN max_score > 0 THEN (score::NUMERIC / max_score * 100) ELSE 0 END
  ) STORED,
  result_id TEXT,           -- ID del resultado (personality quiz)
  result_title TEXT,        -- Título del resultado para display rápido
  time_taken_seconds INTEGER,

  -- Respuestas detalladas
  answers JSONB,

  -- Share tracking
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  was_shared BOOLEAN DEFAULT FALSE,

  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Likes de quizzes
CREATE TABLE quiz_likes (
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (quiz_id, user_id)
);

-- Reportes de quizzes
CREATE TABLE quiz_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  details TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Logros / Achievements
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,           -- 'first_quiz', 'played_100', etc.
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,             -- Emoji
  points_reward INTEGER DEFAULT 0,
  condition_type TEXT NOT NULL,   -- 'plays', 'creates', 'shares', 'score'
  condition_value INTEGER NOT NULL
);

-- Logros desbloqueados por usuario
CREATE TABLE user_achievements (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Búsqueda de quizzes
CREATE INDEX idx_quizzes_slug ON quizzes(slug);
CREATE INDEX idx_quizzes_status ON quizzes(status) WHERE status = 'published';
CREATE INDEX idx_quizzes_category ON quizzes(category_id) WHERE status = 'published';
CREATE INDEX idx_quizzes_language ON quizzes(language) WHERE status = 'published';
CREATE INDEX idx_quizzes_featured ON quizzes(is_featured, featured_at DESC) WHERE is_featured = TRUE;
CREATE INDEX idx_quizzes_popular ON quizzes(plays_count DESC) WHERE status = 'published';
CREATE INDEX idx_quizzes_recent ON quizzes(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_quizzes_tags ON quizzes USING GIN(tags);

-- Búsqueda full-text
CREATE INDEX idx_quizzes_search ON quizzes
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Búsqueda fuzzy por título (para el command menu)
CREATE INDEX idx_quizzes_title_trgm ON quizzes
  USING GIN(title gin_trgm_ops) WHERE status = 'published';

-- Game sessions
CREATE INDEX idx_sessions_quiz ON game_sessions(quiz_id);
CREATE INDEX idx_sessions_player ON game_sessions(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_sessions_share_token ON game_sessions(share_token);

-- Profiles
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_points ON profiles(points DESC);
