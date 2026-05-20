export const APP_CONFIG = {
  name: 'QuizVerse',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  description: 'Crea, comparte y juega quizzes virales',

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  limits: {
    maxQuestionsPerQuiz: 30,
    maxQuizTitleLength: 120,
    maxQuizDescriptionLength: 300,
    maxTagsPerQuiz: 10,
    rateLimit: {
      windowMs: 60_000,
      maxRequests: 30,
    },
  },

  features: {
    aiGeneration: process.env.NEXT_PUBLIC_ENABLE_AI_GENERATION !== 'false',
    ads: process.env.NEXT_PUBLIC_ENABLE_ADS === 'true',
    social: process.env.NEXT_PUBLIC_ENABLE_SOCIAL === 'true',
  },

  analytics: {
    enabled: process.env.NODE_ENV === 'production',
    flushIntervalMs: 30_000,
    batchSize: 10,
  },

  quiz: {
    defaultTimeLimit: 15,
    speedBonusThresholdMs: 5000,
    basePoints: 10,
    perfectScoreBonus: 25,
    achievementPoints: 50,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
