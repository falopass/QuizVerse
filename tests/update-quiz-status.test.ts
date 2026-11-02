import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateSpy: vi.fn(),
  deleteSpy: vi.fn(),
  limitCheck: vi.fn(),
  quizRow: {
    data: null as {
      creator_id: string;
      slug: string;
      language: string;
      status: string;
    } | null,
  },
  updateResult: { error: null as { message: string } | null },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: { check: mocks.limitCheck },
  apiLimiter: { check: mocks.limitCheck },
  createRateLimiter: () => ({ check: mocks.limitCheck }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'creator-1' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => mocks.quizRow,
        }),
      }),
      update: (payload: unknown) => {
        mocks.updateSpy(payload);
        return { eq: async () => mocks.updateResult };
      },
      delete: () => {
        mocks.deleteSpy();
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { deleteQuiz, updateQuiz } from '@/actions/quiz.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

function ownedQuizRow(status = 'pending') {
  return {
    data: { creator_id: 'creator-1', slug: 'quiz-de-prueba', language: 'en', status },
  };
}

beforeEach(() => {
  mocks.updateSpy.mockClear();
  mocks.deleteSpy.mockClear();
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.quizRow = ownedQuizRow();
  mocks.updateResult = { error: null };
});

describe('updateQuiz', () => {
  it('strips a client-sent status so it never reaches the update', async () => {
    const result = await updateQuiz(QUIZ_ID, {
      title: 'A perfectly valid title',
      status: 'published',
      quiz_type: 'personality',
    });

    expect(result.success).toBe(true);
    const payload = mocks.updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ title: 'A perfectly valid title' });
    expect(payload).not.toHaveProperty('status');
  });

  it('rejects edits on a published quiz with a typed conflict', async () => {
    mocks.quizRow = ownedQuizRow('published');

    const result = await updateQuiz(QUIZ_ID, { title: 'A perfectly valid title' });

    expect(result).toMatchObject({ success: false, code: 'conflict' });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it.each(['draft', 'pending', 'rejected', 'archived'])(
    'still edits quizzes in review states: %s',
    async (status) => {
      mocks.quizRow = ownedQuizRow(status);

      const result = await updateQuiz(QUIZ_ID, { title: 'A perfectly valid title' });

      expect(result.success).toBe(true);
      expect(mocks.updateSpy).toHaveBeenCalled();
    }
  );

  it('rate limits before touching the quiz row', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await updateQuiz(QUIZ_ID, { title: 'A perfectly valid title' });

    expect(result).toMatchObject({ success: false, code: 'rate_limited' });
    expect(mocks.limitCheck).toHaveBeenCalledWith('creator-1');
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('rejects a language outside the catalogue locales', async () => {
    const result = await updateQuiz(QUIZ_ID, { language: 'pt' });

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('rejects more than 10 tags, oversized tags and empty tags', async () => {
    const tooMany = await updateQuiz(QUIZ_ID, {
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    const tooLong = await updateQuiz(QUIZ_ID, { tags: ['x'.repeat(31)] });
    const empty = await updateQuiz(QUIZ_ID, { tags: [''] });

    for (const result of [tooMany, tooLong, empty]) {
      expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    }
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('rejects fractional, zero and over-30 estimated minutes', async () => {
    for (const estimated_minutes of [0, 1.5, 31, Number.POSITIVE_INFINITY]) {
      const result = await updateQuiz(QUIZ_ID, { estimated_minutes });
      expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    }
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('returns the generic unexpected failure without leaking the DB message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.updateResult = {
      error: { message: 'violates check constraint "quizzes_title_check"' },
    };

    const result = await updateQuiz(QUIZ_ID, { title: 'A perfectly valid title' });

    expect(result).toMatchObject({ success: false, code: 'unexpected' });
    if (!result.success) {
      expect(result.error).not.toContain('quizzes_title_check');
      expect(result.error).not.toContain('constraint');
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[action:quiz.update]',
      expect.objectContaining({ message: expect.stringContaining('quizzes_title_check') })
    );
    errorSpy.mockRestore();
  });
});

describe('deleteQuiz', () => {
  it('rate limits before touching the quiz row', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await deleteQuiz(QUIZ_ID);

    expect(result).toMatchObject({ success: false, code: 'rate_limited' });
    expect(mocks.limitCheck).toHaveBeenCalledWith('creator-1');
    expect(mocks.deleteSpy).not.toHaveBeenCalled();
  });
});
