import 'server-only';

import {
  dailyChallengeNumber,
  dayKey,
  pickDailyQuestions,
  pickDailyTriviaQuiz,
} from '@/lib/content/daily-pick';
import { getHomePayload, getLaunchHomePayload } from '@/lib/data/public';
import { localizeQuizList } from '@/lib/i18n/catalog';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Question, Quiz } from '@/types/quiz';

type HomePayload = Awaited<ReturnType<typeof getHomePayload>>;

// Los quizzes únicos que muestra la home, en el orden del payload. Son los
// candidatos del quiz del día: la home y `/[locale]/daily` eligen del mismo
// conjunto, así que apuntan siempre al mismo quiz.
export function collectHomeQuizzes(payload: HomePayload, locale: Locale) {
  return [
    ...new Map(
      localizeQuizList(
        [
          ...payload.featured,
          ...payload.trending,
          ...payload.quickPlays,
          ...payload.freshlyPublished,
        ],
        locale
      ).map((quiz) => [quiz.id, quiz])
    ).values(),
  ];
}

export interface DailyChallenge {
  /** El quiz publicado del que salen las preguntas del reto. */
  quiz: Quiz;
  /** Las `DAILY_QUESTION_COUNT` preguntas del día, en su orden original. */
  questions: Question[];
  /** `#` del reto: días editoriales desde el lanzamiento. */
  challengeNumber: number;
  /** Día editorial (America/Santiago) al que pertenece el reto. */
  dayKey: string;
}

/**
 * El reto del día: un quiz de trivia del catálogo publicado del idioma y cinco
 * de sus preguntas, ambos elegidos de forma determinista — mismos para todos
 * ese día en ese idioma.
 *
 * Las `questions` vienen de la columna pública `quizzes.questions` (ya
 * saneada): la clave nunca sale de aquí. El caller aplica `toClientQuiz()`
 * antes de mandar nada al navegador.
 */
export async function getDailyChallenge(
  locale: Locale,
  date = new Date()
): Promise<DailyChallenge | null> {
  const payload = await getHomePayload(locale).catch(() => getLaunchHomePayload(locale));
  const quiz = pickDailyTriviaQuiz(collectHomeQuizzes(payload, locale), date);
  if (!quiz) return null;
  return {
    quiz,
    questions: pickDailyQuestions(quiz.questions, date),
    challengeNumber: dailyChallengeNumber(date),
    dayKey: dayKey(date),
  };
}
