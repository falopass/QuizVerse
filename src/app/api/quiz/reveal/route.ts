/**
 * POST /api/quiz/reveal
 *
 * Tells the play screen whether the option the player just picked was correct,
 * and which wrong options a 50/50 power-up may hide. It exists so the answer
 * key never has to travel to the browser with the quiz.
 *
 * Body: { quizId, questionId, selectedOptionId?, purpose: 'answer' | 'hint' }
 * 200:  { isCorrect, correctOptionId, explanation }  |  { eliminated: string[] }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eliminateWrongOptions, evaluateAnswer } from '@/lib/quiz/answer-key';
import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';
import { createRateLimiter } from '@/lib/utils/rate-limit';

const RevealSchema = z.object({
  quizId: z.string().uuid(),
  questionId: z.string().min(1).max(64),
  selectedOptionId: z.string().min(1).max(64).optional(),
  purpose: z.enum(['answer', 'hint']).default('answer'),
});

/** Generous: one call per question answered, plus a few 50/50 uses. */
const revealLimiter = createRateLimiter('quiz-reveal', 120, 60);

/** Falls back to the forwarded address when the proxy header is missing. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

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

  const { quizId, questionId, selectedOptionId, purpose } = parsed.data;
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

  return NextResponse.json(
    {
      isCorrect: verdict.isCorrect,
      correctOptionId: verdict.correctOptionId,
      explanation: verdict.explanation,
    },
    { headers: NO_STORE }
  );
}
