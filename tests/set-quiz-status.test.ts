import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'creator-1' as string | null,
  quizRow: {
    data: { creator_id: 'creator-1', slug: 'mi-quiz', language: 'es', status: 'draft' } as {
      creator_id: string;
      slug: string;
      language: string;
      status: string;
    } | null,
  },
  statusResult: {
    data: { status: 'pending' } as { status: string } | null,
    error: null as { message: string } | null,
  },
  update: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate, revalidateTag: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => mocks.quizRow }) }),
      update: (payload: unknown) => {
        mocks.update(payload);
        return { eq: () => ({ select: () => ({ single: async () => mocks.statusResult }) }) };
      },
    }),
  }),
}));

import { setQuizStatus } from '@/actions/quiz.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

beforeEach(() => {
  mocks.userId = 'creator-1';
  mocks.quizRow = {
    data: { creator_id: 'creator-1', slug: 'mi-quiz', language: 'es', status: 'draft' },
  };
  mocks.statusResult = { data: { status: 'pending' }, error: null };
  mocks.update.mockClear();
  mocks.revalidate.mockClear();
});

describe('setQuizStatus', () => {
  it('envía un borrador a revisión', async () => {
    const result = await setQuizStatus(QUIZ_ID, 'pending');

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({ status: 'pending' });
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/quiz/mi-quiz');
  });

  it('retira un quiz en revisión a borrador', async () => {
    mocks.quizRow = {
      data: { creator_id: 'creator-1', slug: 'mi-quiz', language: 'es', status: 'pending' },
    };
    mocks.statusResult = { data: { status: 'draft' }, error: null };

    const result = await setQuizStatus(QUIZ_ID, 'draft');

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({ status: 'draft' });
  });

  it('despublica un quiz publicado a archived', async () => {
    mocks.quizRow = {
      data: { creator_id: 'creator-1', slug: 'mi-quiz', language: 'es', status: 'published' },
    };
    mocks.statusResult = { data: { status: 'archived' }, error: null };

    const result = await setQuizStatus(QUIZ_ID, 'archived');

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({ status: 'archived' });
  });

  it('rechaza llevar un quiz a published', async () => {
    const result = await setQuizStatus(QUIZ_ID, 'published');

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rechaza salir de archived (estado terminal para el creador)', async () => {
    mocks.quizRow = {
      data: { creator_id: 'creator-1', slug: 'mi-quiz', language: 'es', status: 'archived' },
    };

    const result = await setQuizStatus(QUIZ_ID, 'draft');

    expect(result).toMatchObject({ success: false, code: 'conflict' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('reporta conflicto si la guardia de la base restauró el estado', async () => {
    mocks.statusResult = { data: { status: 'draft' }, error: null };

    const result = await setQuizStatus(QUIZ_ID, 'pending');

    expect(result).toMatchObject({ success: false, code: 'conflict' });
  });

  it('no deja tocar un quiz ajeno', async () => {
    mocks.quizRow = {
      data: { creator_id: 'otro', slug: 'mi-quiz', language: 'es', status: 'draft' },
    };

    const result = await setQuizStatus(QUIZ_ID, 'pending');

    expect(result).toMatchObject({ success: false, code: 'forbidden' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('exige sesión', async () => {
    mocks.userId = null;

    const result = await setQuizStatus(QUIZ_ID, 'pending');

    expect(result).toMatchObject({ success: false, code: 'unauthorized' });
  });
});
