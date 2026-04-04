/**
 * Sistema de Scoring para QuizVerse
 * Soporta trivia, personality y poll quizzes
 */

import type { Question, Quiz, PersonalityResult, GameSession } from '@/types/quiz';

// ============================================
// CONFIGURACIÓN DE PUNTAJES
// ============================================

const SCORING_CONFIG = {
  BASE_POINTS_CORRECT: 10,
  PERFECT_SCORE_BONUS: 25,
    SPEED_BONUS_MULTIPLIER: 0.5,
  STREAK_BONUS: {
    3: 2,
    5: 5,
    10: 10,
  },
} as const;

// ============================================
// TRIVIA SCORING
// ============================================

export interface TriviaScoreResult {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  streakBonus: number;
  speedBonus: number;
}

/**
 * Calcula el puntaje de un quiz de trivia
 * Considera: respuestas correctas, racha, velocidad
 */
export function calculateTriviaScore(
  questions: Question[],
  answers: { question_id: string; selected_option_id: string; is_correct: boolean; time_ms: number }[]
): TriviaScoreResult {
  let score = 0;
  let correctCount = 0;
  let streak = 0;
  let streakBonus = 0;
  let speedBonus = 0;

  answers.forEach((answer, index) => {
    if (answer.is_correct) {
      correctCount++;
      score += SCORING_CONFIG.BASE_POINTS_CORRECT;

      // Streak bonus
      streak++;
      if (streak >= 10) {
        streakBonus += SCORING_CONFIG.STREAK_BONUS[10];
        score += SCORING_CONFIG.STREAK_BONUS[10];
      } else if (streak >= 5) {
        streakBonus += SCORING_CONFIG.STREAK_BONUS[5];
        score += SCORING_CONFIG.STREAK_BONUS[5];
      } else if (streak >= 3) {
        streakBonus += SCORING_CONFIG.STREAK_BONUS[3];
        score += SCORING_CONFIG.STREAK_BONUS[3];
      }
    } else {
      streak = 0;
    }

    // Speed bonus (si la pregunta tenía time limit)
    const question = questions.find((q) => q.id === answer.question_id);
    const timeLimit = question?.time_limit_seconds || 30;
    const timeTaken = answer.time_ms / 1000;

    if (answer.is_correct && timeTaken < timeLimit) {
      const timeRatio = 1 - timeTaken / timeLimit;
      const bonus = Math.round(SCORING_CONFIG.BASE_POINTS_CORRECT * SCORING_CONFIG.SPEED_BONUS_MULTIPLIER * timeRatio);
      speedBonus += bonus;
      score += bonus;
    }
  });

  const maxScore = questions.length * SCORING_CONFIG.BASE_POINTS_CORRECT * 2; // Max posible con bonus
  const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return {
    score,
    maxScore,
    percentage,
    correctCount,
    streakBonus,
    speedBonus,
  };
}

// ============================================
// PERSONALITY SCORING
// ============================================

export interface PersonalityScoreResult {
  result: PersonalityResult | null;
  tagDistribution: Record<string, number>;
  dominantTag: string | null;
}

/**
 * Calcula el resultado de un personality quiz
 * Basado en la frecuencia de tags seleccionados
 */
export function calculatePersonalityScore(
  questions: Question[],
  answers: { selected_option_id: string }[],
  results: PersonalityResult[]
): PersonalityScoreResult {
  const tagCounts: Record<string, number> = {};

  // Contar tags de cada respuesta
  answers.forEach((answer) => {
    // Encontrar la pregunta y opción correspondiente
    const question = questions.find((q) =>
      q.options.some((o) => o.id === answer.selected_option_id)
    );

    if (!question) return;

    const option = question.options.find((o) => o.id === answer.selected_option_id);

    if (!option?.personality_tags) return;

    option.personality_tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // Encontrar el tag dominante
  const dominantTag = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Encontrar el resultado correspondiente
  const result = dominantTag
    ? results.find((r) => r.personality_tag === dominantTag)
    : results[0] || null;

  return {
    result: result || null,
    tagDistribution: tagCounts,
    dominantTag,
  };
}

// ============================================
// ACHIEVEMENT DETECTION
// ============================================

export interface AchievementCheck {
  achievementId: string;
  unlocked: boolean;
}

/**
 * Verifica si se desbloquearon logros
 */
export function checkAchievements(
  session: {
    percentage: number;
    score: number;
    isPerfectScore: boolean;
  },
  userStats: {
    quizzesPlayed: number;
    categoriesPlayed: Set<string>;
  }
): AchievementCheck[] {
  const achievements: AchievementCheck[] = [];

  // First quiz
  if (userStats.quizzesPlayed === 1) {
    achievements.push({ achievementId: 'first_quiz', unlocked: true });
  }

  // Perfect score
  if (session.percentage === 100) {
    achievements.push({ achievementId: 'perfect_score', unlocked: true });
  }

  // Quiz addict (10 quizzes)
  if (userStats.quizzesPlayed === 10) {
    achievements.push({ achievementId: 'quiz_addict_10', unlocked: true });
  }

  // Quiz master (50 quizzes)
  if (userStats.quizzesPlayed === 50) {
    achievements.push({ achievementId: 'quiz_master_50', unlocked: true });
  }

  // Explorer (5 categorías distintas)
  if (userStats.categoriesPlayed.size === 5) {
    achievements.push({ achievementId: 'explorer', unlocked: true });
  }

  return achievements;
}

// ============================================
// POINTS CALCULATION
// ============================================

export interface PointsResult {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  breakdown: string[];
}

/**
 * Calcula los puntos ganados por completar un quiz
 */
export function calculatePoints(
  scoreResult: TriviaScoreResult | PersonalityScoreResult,
  isPerfectScore: boolean
): PointsResult {
  const breakdown: string[] = [];
  let basePoints = 10; // Completar quiz
  let bonusPoints = 0;

  breakdown.push('+10 por completar');

  if (isPerfectScore) {
    bonusPoints += 25;
    breakdown.push('+25 por puntaje perfecto');
  }

  // Bonus por porcentaje alto (no perfecto)
  if ('percentage' in scoreResult && scoreResult.percentage >= 80 && !isPerfectScore) {
    bonusPoints += 10;
    breakdown.push('+10 por gran desempeño (>80%)');
  }

  return {
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
    breakdown,
  };
}
