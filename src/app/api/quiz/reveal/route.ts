/**
 * POST /api/quiz/reveal
 *
 * Tells the play screen whether the option the player just picked was correct,
 * and which wrong options a 50/50 power-up may hide. It exists so the answer
 * key never has to travel to the browser with the quiz.
 *
 * Body: { quizId, questionId, selectedOptionId?, purpose: 'answer' | 'hint', attempt }
 * 200:  { isCorrect, correctOptionId, explanation }  |  { eliminated: string[] }
 *
 * `attempt` es el token firmado que emite `startQuizAttempt` al empezar la
 * partida. Sin él no hay veredicto: antes cualquier cliente podía pedir la
 * clave pregunta a pregunta sin jugar. Cada pregunta se revela una sola vez por
 * partida y solo hacia adelante.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eliminateWrongOptions, evaluateAnswer } from '@/lib/quiz/answer-key';
import { verifyQuizAttempt, type AttemptFailureReason } from '@/lib/quiz/attempt';
import { claimQuestionReveal } from '@/lib/quiz/attempt-store';
import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';

const RevealSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().min(1).max(64),
  selectedOptionId: z.string().min(1).max(64).optional(),
  purpose: z.enum(['answer', 'hint']).default('answer'),
  attempt: z.string().min(1).max(2048).optional(),
});

/** Generous: one call per question answered, plus a few 50/50 uses. */
const revealLimiter = createRateLimiter('quiz-reveal', 120, 60);

function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function attemptStatus(reason: AttemptFailureReason): number {
  if (reason === 'unavailable') return 503;
  if (reason === 'quiz_mismatch') return 403;
  return 401;
}

export async function POST(request: Request) {
  const { allowed } = await revealLimiter.check(clientIp(request));
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }

  const parsed = RevealSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400, headers: NO_STORE });
  }

  const { quizId, questionId, selectedOptionId, purpose, attempt: attemptToken } = parsed.data;

  if (!attemptToken) {
    return NextResponse.json({ error: 'attempt_required' }, { status: 401, headers: NO_STORE });
  }

  const verification = await verifyQuizAttempt(attemptToken, quizId);
  if (!verification.ok) {
    return NextResponse.json(
      { error: `attempt_${verification.reason}` },
      { status: attemptStatus(verification.reason), headers: NO_STORE }
    );
  }

  const quiz = await loadAnswerKeyByQuizId(quizId);
  if (!quiz) {
    return NextResponse.json({ error: 'quiz_not_found' }, { status: 404, headers: NO_STORE });
  }

  if (purpose === 'hint') {
    return NextResponse.json(
      { eliminated: eliminateWrongOptions(quiz, questionId) },
      { headers: NO_STORE }
    );
  }

  if (!selectedOptionId) {
    return NextResponse.json({ error: 'missing_option' }, { status: 400, headers: NO_STORE });
  }

  const verdict = evaluateAnswer(quiz, questionId, selectedOptionId);
  if (!verdict) {
    return NextResponse.json({ error: 'question_not_found' }, { status: 404, headers: NO_STORE });
  }

  const questionIndex = quiz.questions.findIndex((question) => question.id === questionId);
  const claim = await claimQuestionReveal(
    verification.attempt.attemptId,
    questionId,
    questionIndex,
    selectedOptionId
  );
  if (!claim.ok) {
    return NextResponse.json({ error: claim.reason }, { status: 409, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      isCorrect: verdict.isCorrect,
      correctOptionId: verdict.correctOptionId,
      explanation: verdict.explanation,
    },
    { headers: NO_STORE }
  );
}
