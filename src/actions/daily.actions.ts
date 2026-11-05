'use server';

/**
 * Reto diario: calificación autoritativa del envío.
 *
 * El cliente manda solo lo que eligió; aquí se recalcula cuáles eran las
 * preguntas del reto (misma selección determinista que la página) y se puntúa
 * contra la clave del servidor. No persiste nada ni otorga puntos: la partida
 * diaria vive en localStorage; esto solo devuelve la grilla honesta.
 */

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { evaluateAnswer } from '@/lib/quiz/answer-key';
import {
  attemptsAvailable,
  verifyQuizAttempt,
  warnAttemptsInactive,
  type QuizAttempt,
} from '@/lib/quiz/attempt';
import { claimQuestionReveal, getAttemptReveals } from '@/lib/quiz/attempt-store';
import { QuizAnswerSchema } from '@/lib/quiz/submission';
import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';
import { getDailyChallenge } from '@/lib/data/daily-quiz';
import { DAILY_QUESTION_COUNT, dateFromDayKey, dayKey, dayKeyAdd } from '@/lib/content/daily-pick';
import { quizLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { locales } from '@/lib/i18n/dictionaries';
import { actionFailure, zodMessage, type ActionResult } from '@/lib/actions/types';

const DailySubmissionSchema = z.object({
  quizId: z.string().uuid(),
  locale: z.enum(locales),
  /** Día editorial `YYYY-MM-DD` (America/Santiago) del reto jugado. */
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answers: z.array(QuizAnswerSchema).min(1).max(DAILY_QUESTION_COUNT),
  attempt: z.string().min(1).max(2048).optional(),
});

export interface DailyResultPayload {
  score: number;
  maxScore: number;
  /** Un emoji por pregunta del reto, en orden: true = 🟩, false = 🟥. */
  marks: boolean[];
}

/**
 * Puntúa el reto diario terminado.
 *
 * El attempt firmado es obligatorio cuando el secreto está configurado: sin él
 * esto sería un oráculo de respuestas que salta el anti-trampa del reveal.
 * En modo degradado (sin secreto) se califica igual, como hace el reveal.
 */
export async function submitDailyResult(input: unknown): Promise<ActionResult<DailyResultPayload>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { allowed } = await quizLimiter.check(
    user?.id ?? `anonymous:${clientIpFromHeaders(await headers())}`
  );
  if (!allowed) return actionFailure('rate_limited', 'Too many submissions. Please wait.');

  const parsed = DailySubmissionSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalid_input', zodMessage(parsed.error));

  const { quizId, locale, dayKey: playedKey, answers, attempt: attemptToken } = parsed.data;

  // Solo se califica el reto vigente o el de ayer (carrera de medianoche: el
  // jugador empezó un día y terminó al siguiente). Otros días no existen.
  const todayKey = dayKey(new Date());
  if (playedKey !== todayKey && playedKey !== dayKeyAdd(todayKey, -1)) {
    return actionFailure('invalid_input', 'That daily challenge is no longer current.');
  }

  const secured = attemptsAvailable();
  let attempt: QuizAttempt | null = null;
  if (!secured) {
    warnAttemptsInactive();
  } else {
    if (!attemptToken) return actionFailure('unauthorized', 'Missing game attempt.');
    const verification = await verifyQuizAttempt(attemptToken, quizId);
    if (!verification.ok) return actionFailure('unauthorized', 'Invalid game attempt.');
    attempt = verification.attempt;
  }

  // El conjunto del reto se recalcula aquí: el cliente no decide qué
  // preguntas cuentan ni con qué quiz se jugó el día.
  const challenge = await getDailyChallenge(locale, dateFromDayKey(playedKey)).catch(() => null);
  if (!challenge || challenge.quiz.id !== quizId) {
    return actionFailure('invalid_input', 'That is not the daily challenge.');
  }

  const quiz = await loadAnswerKeyByQuizId(quizId);
  if (!quiz) return actionFailure('not_found', 'Quiz not found.');

  // Lo revelado manda sobre lo enviado (misma regla que `submitQuizResult`):
  // ver la respuesta correcta y enviar otra distinta no mejora el marcador.
  const revealed = attempt ? await getAttemptReveals(attempt.attemptId) : null;

  // Una respuesta por pregunta del reto; la primera gana, como en
  // `scoreSubmission`. Las que no pertenecen al reto se ignoran.
  const chosen = new Map<string, string>();
  for (const answer of answers) {
    if (!chosen.has(answer.question_id)) chosen.set(answer.question_id, answer.selected_option_id);
  }

  const marks: boolean[] = [];
  for (const question of challenge.questions) {
    let optionId = revealed?.[question.id] ?? chosen.get(question.id) ?? null;
    if (attempt && revealed?.[question.id] === undefined && optionId) {
      // Sin reveal previo, la primera opción enviada queda fijada en el
      // attempt: reenviar con otra no convierte el envío en oráculo de la
      // clave del reto. Si el claim falla (fuera de orden o carrera), vale lo
      // ya fijado — y si no hay nada, cuenta como fallo.
      const quizIndex = quiz.questions.findIndex((item) => item.id === question.id);
      const claim = await claimQuestionReveal(attempt.attemptId, question.id, quizIndex, optionId);
      if (!claim.ok) {
        const fresh = await getAttemptReveals(attempt.attemptId);
        optionId = fresh?.[question.id] ?? null;
      }
    }
    marks.push(
      optionId ? (evaluateAnswer(quiz, question.id, optionId)?.isCorrect ?? false) : false
    );
  }

  return {
    success: true,
    score: marks.filter(Boolean).length,
    maxScore: challenge.questions.length,
    marks,
  };
}
