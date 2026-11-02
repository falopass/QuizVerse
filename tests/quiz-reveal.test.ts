/**
 * Contract tests for POST /api/quiz/reveal.
 *
 * The endpoint is the single place where the answer key leaves the server:
 * it must return only a verdict or a hint, throttle by IP, require a valid
 * game attempt, and never leak `is_correct` or the full options list.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerKeyQuiz } from '@/lib/quiz/quiz-repository';

const mocks = vi.hoisted(() => ({
  loadAnswerKey: vi.fn(),
  rateLimitCheck: vi.fn(),
  verifyAttempt: vi.fn(),
  claimReveal: vi.fn(),
  claimHint: vi.fn(),
  attemptsAvailable: true,
  warnInactive: vi.fn(),
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({
  loadAnswerKeyByQuizId: mocks.loadAnswerKey,
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
}));

vi.mock('@/lib/quiz/attempt', () => ({
  verifyQuizAttempt: mocks.verifyAttempt,
  attemptsAvailable: () => mocks.attemptsAvailable,
  warnAttemptsInactive: mocks.warnInactive,
}));

vi.mock('@/lib/quiz/attempt-store', () => ({
  claimQuestionReveal: mocks.claimReveal,
  claimHint: mocks.claimHint,
}));

import { POST } from '@/app/api/quiz/reveal/route';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';
const ATTEMPT = 'signed-attempt-token';

function makeAnswerKeyQuiz(): AnswerKeyQuiz {
  return {
    id: QUIZ_ID,
    slug: 'space-trivia',
    quiz_type: 'trivia',
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the most moons?',
        explanation: 'Saturn leads the moon count.',
        options: [
          { id: 'q1a', text: 'Saturn', is_correct: true },
          { id: 'q1b', text: 'Mars' },
          { id: 'q1c', text: 'Venus' },
          { id: 'q1d', text: 'Mercury' },
        ],
      },
      {
        id: 'q2',
        question: 'What is the Moon made of?',
        options: [
          { id: 'q2a', text: 'Rock', is_correct: true },
          { id: 'q2b', text: 'Cheese' },
        ],
      },
    ],
    results: null,
  };
}

function revealRequest(body: unknown): Request {
  return new Request('http://test/api/quiz/reveal', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validAnswer = {
  quizId: QUIZ_ID,
  questionId: 'q1',
  selectedOptionId: 'q1a',
  attempt: ATTEMPT,
};
const validHint = { quizId: QUIZ_ID, questionId: 'q1', purpose: 'hint', attempt: ATTEMPT };

beforeEach(() => {
  mocks.loadAnswerKey.mockReset();
  mocks.loadAnswerKey.mockResolvedValue(makeAnswerKeyQuiz());
  mocks.rateLimitCheck.mockReset();
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 119, reset: 60 });
  mocks.verifyAttempt.mockReset();
  mocks.verifyAttempt.mockResolvedValue({
    ok: true,
    attempt: {
      quizId: QUIZ_ID,
      attemptId: 'attempt-1',
      issuedAt: 1_700_000_000,
      expiresAt: 1_800_000_000,
    },
  });
  mocks.claimReveal.mockReset();
  mocks.claimReveal.mockResolvedValue({ ok: true });
  mocks.claimHint.mockReset();
  mocks.claimHint.mockResolvedValue({ ok: true });
  mocks.attemptsAvailable = true;
  mocks.warnInactive.mockClear();
});

describe('POST /api/quiz/reveal — answer', () => {
  it('returns the verdict with the correct option and no-store', async () => {
    const response = await POST(revealRequest(validAnswer));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      isCorrect: true,
      correctOptionId: 'q1a',
      explanation: 'Saturn leads the moon count.',
    });
  });

  it('marks a wrong pick incorrect but still reveals the right option', async () => {
    const response = await POST(revealRequest({ ...validAnswer, selectedOptionId: 'q1b' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isCorrect).toBe(false);
    expect(body.correctOptionId).toBe('q1a');
  });

  it('marca la pregunta como revelada con su índice y la opción elegida', async () => {
    await POST(revealRequest(validAnswer));

    expect(mocks.claimReveal).toHaveBeenCalledWith('attempt-1', 'q1', 0, 'q1a');
  });

  it('rechaza un reveal sin attempt', async () => {
    const response = await POST(revealRequest({ ...validAnswer, attempt: undefined }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'attempt_required' });
    expect(mocks.verifyAttempt).not.toHaveBeenCalled();
    expect(mocks.loadAnswerKey).not.toHaveBeenCalled();
  });

  it('rechaza un attempt de otro quiz', async () => {
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'quiz_mismatch' });

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'attempt_quiz_mismatch' });
    expect(mocks.loadAnswerKey).not.toHaveBeenCalled();
  });

  it('rechaza un attempt caducado', async () => {
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'expired' });

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'attempt_expired' });
  });

  it('rechaza un attempt con firma inválida', async () => {
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'bad_signature' });

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'attempt_bad_signature' });
  });

  it('falla cerrado cuando no hay secreto para verificar attempts', async () => {
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'unavailable' });

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'attempt_unavailable' });
  });

  it('rechaza una pregunta ya revelada en la misma partida', async () => {
    mocks.claimReveal.mockResolvedValue({ ok: false, reason: 'already_revealed' });

    const response = await POST(revealRequest(validAnswer));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: 'already_revealed' });
    expect(body).not.toHaveProperty('correctOptionId');
  });

  it('rechaza un attempt mal formado', async () => {
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'malformed' });

    const response = await POST(revealRequest({ ...validAnswer, attempt: 'basura' }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'attempt_malformed' });
  });

  it('rechaza una pregunta que retrocede en el orden', async () => {
    mocks.claimReveal.mockResolvedValue({ ok: false, reason: 'out_of_order' });

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'out_of_order' });
  });

  it('rejects an answer without selectedOptionId', async () => {
    const response = await POST(
      revealRequest({ quizId: QUIZ_ID, questionId: 'q1', purpose: 'answer', attempt: ATTEMPT })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'missing_option' });
  });

  it('returns 404 for a question outside the quiz', async () => {
    const response = await POST(revealRequest({ ...validAnswer, questionId: 'nope' }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'question_not_found' });
    expect(mocks.claimReveal).not.toHaveBeenCalled();
  });

  it('never exposes the answer key or the option list', async () => {
    const response = await POST(revealRequest(validAnswer));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain('is_correct');
    expect(body).not.toHaveProperty('options');
    expect(body).not.toHaveProperty('questions');
  });
});

describe('POST /api/quiz/reveal — hint', () => {
  it('returns eliminated wrong options without revealing the correct one', async () => {
    const response = await POST(revealRequest(validHint));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.eliminated).toHaveLength(2);
    for (const id of body.eliminated) {
      expect(['q1b', 'q1c', 'q1d']).toContain(id);
    }
    expect(body.eliminated).not.toContain('q1a');
    expect(body).not.toHaveProperty('correctOptionId');
    // La pista se marca aparte: no consume el reveal de la pregunta.
    expect(mocks.claimHint).toHaveBeenCalledWith('attempt-1', 'q1');
    expect(mocks.claimReveal).not.toHaveBeenCalled();
  });

  it('rechaza una segunda pista en otra pregunta de la misma partida', async () => {
    mocks.claimHint.mockResolvedValue({ ok: false, reason: 'hint_already_used' });

    const response = await POST(revealRequest({ ...validHint, questionId: 'q2' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'hint_already_used' });
  });

  it('repetir la pista de la misma pregunta es idempotente', async () => {
    const first = await POST(revealRequest(validHint));
    const second = await POST(revealRequest(validHint));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ eliminated: expect.any(Array) });
  });

  it('también exige attempt', async () => {
    const response = await POST(revealRequest({ ...validHint, attempt: undefined }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'attempt_required' });
  });

  it('returns an empty list when there is nothing worth hiding', async () => {
    const response = await POST(revealRequest({ ...validHint, questionId: 'q2' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ eliminated: [] });
  });

  it('no gasta la pista si la pregunta no existe', async () => {
    const response = await POST(revealRequest({ ...validHint, questionId: 'nope' }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'question_not_found' });
    expect(mocks.claimHint).not.toHaveBeenCalled();
  });
});

describe('POST /api/quiz/reveal — modo degradado (sin secreto)', () => {
  beforeEach(() => {
    mocks.attemptsAvailable = false;
  });

  it('responde el veredicto sin attempt, como antes del anti-trampa', async () => {
    const response = await POST(revealRequest({ ...validAnswer, attempt: undefined }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      isCorrect: true,
      correctOptionId: 'q1a',
      explanation: 'Saturn leads the moon count.',
    });
    expect(mocks.verifyAttempt).not.toHaveBeenCalled();
    expect(mocks.claimReveal).not.toHaveBeenCalled();
  });

  it('avisó del anti-trampa inactivo', async () => {
    await POST(revealRequest({ ...validAnswer, attempt: undefined }));

    expect(mocks.warnInactive).toHaveBeenCalled();
  });

  it('la pista 50/50 también responde sin attempt', async () => {
    const response = await POST(
      revealRequest({ ...validHint, attempt: undefined, questionId: 'q1' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eliminated).toHaveLength(2);
    expect(body.eliminated).not.toContain('q1a');
    expect(mocks.claimHint).not.toHaveBeenCalled();
  });

  it('ignora un token que viaje en la petición (no hay firma que verificar)', async () => {
    const response = await POST(revealRequest({ ...validAnswer, attempt: 'token-inventado' }));

    expect(response.status).toBe(200);
    expect(mocks.verifyAttempt).not.toHaveBeenCalled();
  });

  it('una pregunta repetida responde igual (no hay estado por partida)', async () => {
    const first = await POST(revealRequest({ ...validAnswer, attempt: undefined }));
    const second = await POST(revealRequest({ ...validAnswer, attempt: undefined }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});

describe('POST /api/quiz/reveal — validation', () => {
  it('rejects a payload that fails the schema', async () => {
    const response = await POST(revealRequest({ ...validAnswer, quizId: 'no-es-un-uuid' }));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'invalid_payload' });
    expect(mocks.loadAnswerKey).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const response = await POST(revealRequest('esto no es json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
    expect(mocks.loadAnswerKey).not.toHaveBeenCalled();
  });

  it('returns 404 when the quiz is not published', async () => {
    mocks.loadAnswerKey.mockResolvedValue(null);

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'quiz_not_found' });
  });
});

describe('POST /api/quiz/reveal — rate limit', () => {
  it('returns 429 with Retry-After and never touches the answer key', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, remaining: 0, reset: 60 });

    const response = await POST(revealRequest(validAnswer));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(mocks.loadAnswerKey).not.toHaveBeenCalled();
    expect(mocks.verifyAttempt).not.toHaveBeenCalled();
  });
});
