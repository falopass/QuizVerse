import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  revalidate: vi.fn(),
  limitCheck: vi.fn(),
  profileResult: { data: { is_admin: true } as { is_admin: boolean } | null },
  quizRow: {
    data: { creator_id: 'user-1', slug: 'quiz-de-prueba', language: 'en' } as {
      creator_id: string;
      slug: string;
      language: string;
    } | null,
  },
  insertResult: { data: { id: 'quiz-1', slug: 'quiz-de-prueba' } as unknown, error: null },
  updateResult: { error: null as { message: string } | null },
  deleteResult: { error: null as { message: string } | null },
  rpcResult: { data: true as unknown, error: null as { message: string } | null },
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidate,
}));

vi.mock('next/headers', () => ({
  headers: async () => new Map(),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  quizLimiter: { check: mocks.limitCheck },
  apiLimiter: { check: mocks.limitCheck },
  createRateLimiter: () => ({ check: mocks.limitCheck }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => mocks.profileResult }) }),
        };
      }
      if (table !== 'quizzes') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => mocks.quizRow }) }),
        insert: () => ({ select: () => ({ single: async () => mocks.insertResult }) }),
        update: () => ({ eq: async () => mocks.updateResult }),
        delete: () => ({ eq: async () => mocks.deleteResult }),
      };
    },
    rpc: async () => mocks.rpcResult,
  }),
}));

vi.mock('@/lib/quiz/quiz-slug', () => ({
  generateUniqueSlug: async () => 'quiz-de-prueba',
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({ loadAnswerKeyByQuizId: vi.fn() }));
vi.mock('@/lib/quiz/achievements', () => ({ checkAchievements: async () => [] }));

import { createQuiz, deleteQuiz, likeQuiz, updateQuiz } from '@/actions/quiz.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

const createInput = (language: string) => ({
  title: 'Quiz de prueba',
  quiz_type: 'trivia',
  difficulty: 'easy',
  language,
  questions: [
    {
      id: 'q1',
      question: '¿Capital de Chile?',
      options: [
        { id: 'a', text: 'Santiago', is_correct: true },
        { id: 'b', text: 'Lima', is_correct: false },
      ],
    },
  ],
});

beforeEach(() => {
  mocks.userId = 'user-1';
  mocks.revalidate.mockClear();
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.profileResult = { data: { is_admin: true } };
  mocks.quizRow = { data: { creator_id: 'user-1', slug: 'quiz-de-prueba', language: 'en' } };
  mocks.insertResult = { data: { id: 'quiz-1', slug: 'quiz-de-prueba' }, error: null };
  mocks.updateResult = { error: null };
  mocks.deleteResult = { error: null };
  mocks.rpcResult = { data: true, error: null };
});

const HUB_PATHS = [
  ['/[locale]/category/[slug]', 'page'],
  ['/[locale]/profile/[username]', 'page'],
];

const expectHubs = () => {
  for (const args of HUB_PATHS) {
    expect(mocks.revalidate).toHaveBeenCalledWith(...args);
  }
};

describe('createQuiz', () => {
  it('revalida las rutas localizadas del locale del quiz', async () => {
    const result = await createQuiz(createInput('es'));

    expect(result.success).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledTimes(5);
    expect(mocks.revalidate).toHaveBeenCalledWith('/es');
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz');
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz/quiz-de-prueba');
    expectHubs();
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/');
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/quiz');
  });

  it('revalida ambos locales cuando el language no es en/es', async () => {
    const result = await createQuiz(createInput('pt'));

    expect(result.success).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledTimes(8);
    for (const locale of ['en', 'es']) {
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz/quiz-de-prueba`);
    }
    expectHubs();
  });
});

describe('updateQuiz', () => {
  it('revalida el locale original y el nuevo cuando cambia el language', async () => {
    const result = await updateQuiz(QUIZ_ID, { language: 'es' });

    expect(result.success).toBe(true);
    // 3 paths × 2 locales + 2 hub patterns × 2 calls (los hubs se repiten, es idempotente)
    expect(mocks.revalidate).toHaveBeenCalledTimes(10);
    for (const locale of ['en', 'es']) {
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz`);
      expect(mocks.revalidate).toHaveBeenCalledWith(`/${locale}/quiz/quiz-de-prueba`);
    }
    expectHubs();
  });
});

describe('deleteQuiz', () => {
  it('revalida home, explore y detalle del locale del quiz', async () => {
    const result = await deleteQuiz(QUIZ_ID);

    expect(result.success).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledTimes(5);
    expect(mocks.revalidate).toHaveBeenCalledWith('/en');
    expect(mocks.revalidate).toHaveBeenCalledWith('/en/quiz');
    expect(mocks.revalidate).toHaveBeenCalledWith('/en/quiz/quiz-de-prueba');
    expectHubs();
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/');
    expect(mocks.revalidate).not.toHaveBeenCalledWith('/quiz');
  });
});

describe('likeQuiz', () => {
  it('revalida detalle y explorar localizados, por slug y no por id', async () => {
    mocks.quizRow = { data: { creator_id: 'otro', slug: 'quiz-de-prueba', language: 'es' } };

    const result = await likeQuiz(QUIZ_ID);

    expect(result).toEqual({ success: true, liked: true });
    expect(mocks.revalidate).toHaveBeenCalledTimes(2);
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz');
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz/quiz-de-prueba');
    expect(mocks.revalidate).not.toHaveBeenCalledWith(`/quiz/${QUIZ_ID}`);
  });

  it('no revalida si el quiz no existe', async () => {
    mocks.quizRow = { data: null };

    const result = await likeQuiz(QUIZ_ID);

    expect(result.success).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
