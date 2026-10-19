/**
 * Contract tests for the browser-side reveal client.
 *
 * The play screen asks `/api/quiz/reveal` for verdicts and 50/50 hints.
 * Both helpers must resolve to `null` on ANY failure — the player degrades
 * to "no feedback" and the game must never get stuck.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAnswerVerdict, requestEliminatedOptions } from '@/lib/quiz/reveal-client';

const INPUT = { quizId: 'quiz-1', questionId: 'q1', selectedOptionId: 'q1a' };
const HINT_INPUT = { quizId: 'quiz-1', questionId: 'q1' };

function okResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as Response;
}

function lastRequest(): { url: string; init: RequestInit } {
  const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!;
  return { url: url as string, init: init! };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestAnswerVerdict', () => {
  it('returns the verdict on a well-formed ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          isCorrect: true,
          correctOptionId: 'q1a',
          explanation: 'Saturn has the most moons.',
        })
      )
    );

    const result = await requestAnswerVerdict(INPUT);

    expect(result).toEqual({
      isCorrect: true,
      correctOptionId: 'q1a',
      explanation: 'Saturn has the most moons.',
    });
  });

  it('POSTs to /api/quiz/reveal with purpose "answer" and no-store cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ isCorrect: false })));

    await requestAnswerVerdict(INPUT);

    const { url, init } = lastRequest();
    expect(url).toBe('/api/quiz/reveal');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ ...INPUT, purpose: 'answer' });
  });

  it.each([{}, { isCorrect: 'yes' }, { isCorrect: 1 }, 'not an object', null])(
    'returns null when isCorrect is missing or not a boolean: %j',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)));
      expect(await requestAnswerVerdict(INPUT)).toBeNull();
    }
  );

  it('normalizes non-string correctOptionId and explanation to null', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse({ isCorrect: false, correctOptionId: 42, explanation: { es: 'x' } })
        )
    );

    expect(await requestAnswerVerdict(INPUT)).toEqual({
      isCorrect: false,
      correctOptionId: null,
      explanation: null,
    });
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: vi.fn() } as unknown as Response)
    );
    expect(await requestAnswerVerdict(INPUT)).toBeNull();
  });

  it('returns null when fetch throws (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await requestAnswerVerdict(INPUT)).toBeNull();
  });

  it('returns null when the body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as unknown as Response)
    );
    expect(await requestAnswerVerdict(INPUT)).toBeNull();
  });
});

describe('requestEliminatedOptions', () => {
  it('returns the eliminated option ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ eliminated: ['a', 'c'] })));
    expect(await requestEliminatedOptions(HINT_INPUT)).toEqual(['a', 'c']);
  });

  it('POSTs to /api/quiz/reveal with purpose "hint" and no-store cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ eliminated: [] })));

    await requestEliminatedOptions(HINT_INPUT);

    const { url, init } = lastRequest();
    expect(url).toBe('/api/quiz/reveal');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(JSON.parse(init.body as string)).toEqual({ ...HINT_INPUT, purpose: 'hint' });
  });

  it('filters out non-string entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse({ eliminated: ['a', 3, null, 'b', {}] }))
    );
    expect(await requestEliminatedOptions(HINT_INPUT)).toEqual(['a', 'b']);
  });

  it.each([{}, { eliminated: 'a' }, { eliminated: null }, 'x', null])(
    'returns null when eliminated is missing or not an array: %j',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)));
      expect(await requestEliminatedOptions(HINT_INPUT)).toBeNull();
    }
  );

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await requestEliminatedOptions(HINT_INPUT)).toBeNull();
  });
});
