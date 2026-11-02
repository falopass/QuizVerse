import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteResult: { error: null as { code?: string; message: string } | null },
  updateSpy: vi.fn(),
  updateResult: { error: null as { message: string } | null },
  revalidate: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidate,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: { check: async () => ({ allowed: true }) },
  apiLimiter: { check: async () => ({ allowed: true }) },
  createRateLimiter: () => ({ check: async () => ({ allowed: true }) }),
}));
vi.mock('@/lib/quiz/quiz-repository', () => ({ loadAnswerKeyByQuizId: vi.fn() }));
vi.mock('@/lib/quiz/achievements', () => ({ checkAchievements: async () => [] }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'creator-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { creator_id: 'creator-1', slug: 'mi-quiz', language: 'es' },
            error: null,
          }),
        }),
      }),
      update: (payload: unknown) => {
        mocks.updateSpy(payload);
        return { eq: async () => mocks.updateResult };
      },
      delete: () => ({ eq: async () => mocks.deleteResult }),
    }),
  }),
}));

import { deleteQuiz } from '@/actions/quiz.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

beforeEach(() => {
  mocks.deleteResult = { error: null };
  mocks.updateResult = { error: null };
  mocks.updateSpy.mockClear();
  mocks.revalidate.mockClear();
});

describe('deleteQuiz con guard de reportes abiertos (migración 016)', () => {
  it('sin migración borra igual que siempre (compat hacia atrás)', async () => {
    const result = await deleteQuiz(QUIZ_ID);
    expect(result).toEqual({ success: true, archived: false });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('con QVM03 archiva el quiz en vez de borrarlo', async () => {
    mocks.deleteResult = {
      error: { code: 'QVM03', message: 'El quiz tiene reportes abiertos' },
    };

    const result = await deleteQuiz(QUIZ_ID);
    expect(result).toEqual({ success: true, archived: true });
    expect(mocks.updateSpy).toHaveBeenCalledWith({ status: 'archived' });
  });

  it('otros errores de la base se reportan como unexpected sin archivar', async () => {
    mocks.deleteResult = { error: { code: '23503', message: 'fk violation' } };

    const result = await deleteQuiz(QUIZ_ID);
    expect(result).toMatchObject({ success: false, code: 'unexpected' });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });
});
