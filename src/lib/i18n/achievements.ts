import type { Locale } from '@/lib/i18n/dictionaries';
import type { ProgressUnit } from '@/lib/quiz/achievement-progress';

export interface AchievementCopy {
  name: string;
  description: string;
}

/**
 * Copy de los logros por id. El catálogo (`achievements`) guarda nombre y
 * descripción solo en inglés; la UI bilingüe lee de aquí y cae al texto de la
 * fila si el id no está traducido (un logro nuevo no rompe la página).
 */
export const ACHIEVEMENT_COPY: Record<string, Record<Locale, AchievementCopy>> = {
  first_quiz: {
    es: { name: 'Primeros pasos', description: 'Completa tu primer quiz.' },
    en: { name: 'First Steps', description: 'Complete your first quiz.' },
  },
  quiz_addict_10: {
    es: { name: 'Adicto a los quizzes', description: 'Completa 10 quizzes.' },
    en: { name: 'Quiz Addict', description: 'Complete 10 quizzes.' },
  },
  quiz_master_50: {
    es: { name: 'Maestro de quizzes', description: 'Completa 50 quizzes.' },
    en: { name: 'Quiz Master', description: 'Complete 50 quizzes.' },
  },
  perfect_score: {
    es: { name: 'Impecable', description: 'Consigue un puntaje perfecto en cualquier quiz.' },
    en: { name: 'Flawless', description: 'Get a perfect score on any quiz.' },
  },
  creator: {
    es: { name: 'Creador', description: 'Publica tu primer quiz.' },
    en: { name: 'Quiz Creator', description: 'Create your first quiz.' },
  },
  week_streak: {
    es: { name: 'Racha de fuego', description: 'Juega quizzes 7 días seguidos.' },
    en: { name: 'Streak Master', description: 'Play quizzes 7 days in a row.' },
  },
  explorer: {
    es: { name: 'Explorador', description: 'Juega quizzes de 5 categorías distintas.' },
    en: { name: 'Explorer', description: 'Play quizzes from 5 different categories.' },
  },
  going_viral: {
    es: { name: 'Viral', description: 'Tu quiz llega a 100 partidas.' },
    en: { name: 'Going Viral', description: 'Your quiz reaches 100 plays.' },
  },
  internet_famous: {
    es: { name: 'Famoso en internet', description: 'Tu quiz llega a 1000 partidas.' },
    en: { name: 'Internet Famous', description: 'Your quiz reaches 1000 plays.' },
  },
  social_butterfly: {
    es: { name: 'Mariposa social', description: 'Comparte 10 resultados de quiz.' },
    en: { name: 'Social Butterfly', description: 'Share 10 quiz results.' },
  },
};

/** Unidad del progreso, para el patrón «4/7 días». */
export const PROGRESS_UNIT_LABELS: Record<ProgressUnit, Record<Locale, string>> = {
  plays: { es: 'partidas', en: 'quizzes' },
  creates: { es: 'creados', en: 'created' },
  days: { es: 'días', en: 'days' },
  categories: { es: 'categorías', en: 'categories' },
};

export function achievementCopy(
  id: string,
  locale: Locale,
  fallback: AchievementCopy
): AchievementCopy {
  return ACHIEVEMENT_COPY[id]?.[locale] ?? fallback;
}
