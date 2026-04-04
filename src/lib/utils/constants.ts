/**
 * Constantes globales de la aplicación
 */

// Configuración de quizzes
export const QUIZ_CONFIG = {
  DEFAULT_QUESTION_COUNT: 10,
  MIN_QUESTION_COUNT: 3,
  MAX_QUESTION_COUNT: 20,
  DEFAULT_TIME_LIMIT: 30, // segundos por pregunta
  MIN_TIME_LIMIT: 10,
  MAX_TIME_LIMIT: 60,
} as const;

// Sistema de puntos
export const POINTS = {
  COMPLETE_QUIZ: 10,
  PERFECT_SCORE: 25,
  CREATE_QUIZ: 30,
  QUIZ_100_PLAYS: 50,
  QUIZ_1000_PLAYS: 200,
  SHARE_RESULT: 5,
  WEEK_STREAK: 50,
} as const;

// Categorías por defecto (deben coincidir con la DB)
export const CATEGORIES = [
  { slug: 'personality', name: 'Personality', icon: '🧠' },
  { slug: 'movies-tv', name: 'Movies & TV', icon: '🎬' },
  { slug: 'music', name: 'Music', icon: '🎵' },
  { slug: 'gaming', name: 'Gaming', icon: '🎮' },
  { slug: 'science', name: 'Science', icon: '🔬' },
  { slug: 'history', name: 'History', icon: '📜' },
  { slug: 'sports', name: 'Sports', icon: '⚽' },
  { slug: 'geography', name: 'Geography', icon: '🌍' },
  { slug: 'anime-manga', name: 'Anime & Manga', icon: '⛩️' },
  { slug: 'food-drink', name: 'Food & Drink', icon: '🍕' },
  { slug: 'literature', name: 'Literature', icon: '📚' },
  { slug: 'technology', name: 'Technology', icon: '💻' },
  { slug: 'pop-culture', name: 'Pop Culture', icon: '🌟' },
  { slug: 'animals', name: 'Animals', icon: '🐾' },
  { slug: 'relationships', name: 'Relationships', icon: '💕' },
] as const;

// Tipos de quiz
export const QUIZ_TYPES = {
  TRIVIA: 'trivia',
  PERSONALITY: 'personality',
  POLL: 'poll',
} as const;

// Estados de quiz
export const QUIZ_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
} as const;

// Dificultades
export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

// Configuración de ads
export const AD_CONFIG = {
  QUESTIONS_BETWEEN_ADS: 5,
  ENABLED: process.env.NEXT_PUBLIC_ADSENSE_ID ? true : false,
} as const;

// URLs y rutas
export const ROUTES = {
  HOME: '/',
  QUIZexplORER: '/quiz',
  CREATE: '/create',
  CREATE_AI: '/create/ai',
  LEADERBOARD: '/leaderboard',
  PROFILE: (username: string) => `/profile/${username}`,
  SETTINGS: '/profile/settings',
  LOGIN: '/login',
  ADMIN: '/admin',
} as const;

// Redes sociales para compartir
export const SHARE_PLATFORMS = {
  WHATSAPP: 'whatsapp',
  TWITTER: 'twitter',
  FACEBOOK: 'facebook',
  COPY: 'copy',
} as const;
