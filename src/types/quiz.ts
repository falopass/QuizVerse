/**
 * Tipos específicos para Quiz Engine
 */

import type { QuizType, Difficulty, QuizStatus } from './database';

export type CoverMode = 'procedural' | 'stock' | 'generated' | 'curated';

export type VisualFamily =
  | 'space-opera'
  | 'dark-fantasy'
  | 'science-lab'
  | 'retro-mystery'
  | 'neon-drama'
  | 'corporate-chaos'
  | 'comedy-stage'
  | 'academic-strategy'
  | 'bright-platformer'
  | 'editorial-generic'
  | 'lifestyle-soft'
  | 'personality-pulse';

export type ThemeKey =
  | 'stranger-things'
  | 'star-wars'
  | 'the-boys'
  | 'euphoria'
  | 're-zero'
  | 'witch-hat-atelier'
  | 'dr-stone'
  | 'mario'
  | 'hacks'
  | 'beef'
  | 'classroom-of-the-elite'
  | 'generic-trivia'
  | 'generic-personality'
  | 'generic-lifestyle';

export interface VisualProfile {
  theme_key: ThemeKey;
  visual_family: VisualFamily;
  cover_mode: CoverMode;
  cover_prompt: string;
  cover_search_terms: string[];
}

// ============================================
// QUIZ
// ============================================

export interface Quiz {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  quiz_type: QuizType;
  difficulty: Difficulty;
  language: string;
  questions: Question[];
  results: PersonalityResult[] | null;
  tags: string[];
  estimated_minutes: number;
  plays_count: number;
  shares_count: number;
  avg_score: number | null;
  likes_count: number;
  status: QuizStatus;
  is_featured: boolean;
  is_ai_generated: boolean;
  published_at: string | null;
  created_at: string;
  visual_profile?: VisualProfile;
  // Datos relacionados (opcional)
  category?: Category | null;
  creator?: Profile | null;
}

export interface QuizCardViewModel {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  quiz_type: QuizType;
  difficulty: Difficulty;
  language: string;
  estimated_minutes: number;
  plays_count: number;
  likes_count: number;
  avg_score: number | null;
  is_featured: boolean;
  tags: string[];
  visual_profile?: VisualProfile;
  category?: Category | null;
}

// ============================================
// QUESTION
// ============================================

export interface Question {
  id: string;
  question: string;
  image_url?: string | null;
  options: Option[];
  explanation?: string | null;
  time_limit_seconds?: number | null;
}

export interface Option {
  id: string;
  text: string;
  is_correct?: boolean;      // Para trivia
  personality_tags?: string[]; // Para personality
  image_url?: string | null;
}

// ============================================
// RESULT (Personality Quiz)
// ============================================

export interface PersonalityResult {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  min_score?: number;
  max_score?: number;
  personality_tag?: string;
  background_theme?: 'fire' | 'ice' | 'stars' | 'ocean' | 'forest' | 'mystic';
}

// ============================================
// GAME SESSION
// ============================================

export interface GameSession {
  id: string;
  quiz_id: string;
  player_id: string | null;
  score: number;
  max_score: number;
  percentage: number;
  result_id: string | null;
  result_title: string | null;
  time_taken_seconds: number | null;
  answers: Answer[] | null;
  share_token: string;
  was_shared: boolean;
  completed_at: string;
  // Datos relacionados
  quiz?: Quiz;
}

export interface Answer {
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
  time_ms: number;
}

// ============================================
// PROFILE
// ============================================

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  points: number;
  quizzes_played: number;
  quizzes_created: number;
  is_admin: boolean;
  is_verified: boolean;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// CATEGORY
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  quiz_count: number;
  sort_order: number;
}

// ============================================
// ACHIEVEMENT
// ============================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points_reward: number;
  condition_type: string;
  condition_value: number;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface GenerateQuizRequest {
  topic: string;
  quiz_type: QuizType;
  difficulty: Difficulty;
  num_questions: number;
  language: string;
}

export interface GenerateQuizResponse {
  quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>;
  success: boolean;
  error?: string;
}

export interface SearchQuizzesResponse {
  quizzes: Quiz[];
  total: number;
  has_more: boolean;
}

export interface SubmitSessionRequest {
  quiz_id: string;
  answers: Answer[];
  time_taken_seconds: number;
}

export interface SubmitSessionResponse {
  session: GameSession;
  result: PersonalityResult | null;
  points_earned: number;
  achievements_unlocked: Achievement[];
}

export interface QuizSessionResult {
  id: string;
  quiz_id: string;
  player_id: string | null;
  score: number;
  max_score: number;
  percentage: number;
  result_id: string | null;
  result_title: string | null;
  time_taken_seconds: number | null;
  answers: Answer[] | null;
  share_token: string;
  was_shared: boolean;
  completed_at: string;
}

// ============================================
// QUIZ STATE (para el hook use-quiz-state)
// ============================================

export interface QuizState {
  status: 'idle' | 'playing' | 'completed';
  current_question_index: number;
  answers: Answer[];
  score: number;
  selected_option_id: string | null;
  is_correct: boolean | null;
  time_remaining: number;
}

export type QuizAction =
  | { type: 'START_QUIZ' }
  | { type: 'SELECT_OPTION'; optionId: string }
  | { type: 'SUBMIT_ANSWER'; is_correct: boolean; time_ms: number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'COMPLETE_QUIZ'; score: number; max_score: number }
  | { type: 'TICK_TIME'; remaining: number }
  | { type: 'RESET' };
