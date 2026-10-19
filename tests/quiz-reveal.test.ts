/**
 * Contract tests for POST /api/quiz/reveal.
 *
 * The endpoint is the single place where the answer key leaves the server:
 * it must return only a verdict or a hint, throttle by IP, and never leak
 * `is_correct` or the full options list.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerKeyQuiz } from '@/lib/quiz/quiz-repository';

const mocks = vi.hoisted(() => ({
  loadAnswerKey: vi.fn(),
  rateLimitCheck: vi.fn(),
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({
  loadAnswerKeyByQuizId: mocks.loadAnswerKey,
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: mocks.rateLimitCheck })),
}));

import { POST } from '@/app/api/quiz/reveal/route';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';

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

const validAnswer = { quizId: QUIZ_ID, questionId: 'q1', selectedOptionId: 'q1a' };
const validHint = { quizId: QUIZ_ID, questionId: 'q1', purpose: 'hint' };

beforeEach(() => {
  mocks.loadAnswerKey.mockReset();
  mocks.loadAnswerKey.mockResolvedValue(makeAnswerKeyQuiz());
  mocks.rateLimitCheck.mockReset();
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 119, reset: 60 });
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

  it('rejects an answer without selectedOptionId', async () => {
    const response = await POST(
      revealRequest({ quizId: QUIZ_ID, questionId: 'q1', purpose: 'answer' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'missing_option' });
  });

  it('returns 404 for a question outside the quiz', async () => {
    const response = await POST(revealRequest({ ...validAnswer, questionId: 'nope' }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'question_not_found' });
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
  });

  it('returns an empty list when there is nothing worth hiding', async () => {
    const response = await POST(revealRequest({ ...validHint, questionId: 'q2' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ eliminated: [] });
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
  });
});
