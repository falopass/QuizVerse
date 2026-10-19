import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  insertSpy: vi.fn(),
  insertResult: { data: null as unknown, error: null as { message: string } | null },
  selectResult: { data: [] as unknown[] | null, error: null as { message: string } | null },
  limitCheck: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '1.2.3.4, 5.6.7.8']]),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: () => ({ check: mocks.limitCheck }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
    from: (table: string) => {
      if (table !== 'quiz_comments') throw new Error(`unexpected table ${table}`);
      return {
        insert: (payload: unknown) => {
          mocks.insertSpy(payload);
          return { select: () => ({ single: async () => mocks.insertResult }) };
        },
        select: () => ({
          eq: () => ({ order: () => ({ limit: async () => mocks.selectResult }) }),
        }),
      };
    },
  }),
}));

import { createComment, getQuizComments } from '@/actions/comments.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
const ROW = {
  id: 'comment-1',
  body: 'Buenísimo',
  created_at: '2026-10-19T00:00:00Z',
  author: { username: 'ada', display_name: 'Ada', avatar_url: null },
};

describe('createComment', () => {
  beforeEach(() => {
    mocks.userId = 'user-1';
    mocks.insertSpy.mockClear();
    mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
    mocks.insertResult = { data: ROW, error: null };
  });

  it('devuelve unauthorized sin sesión y no inserta', async () => {
    mocks.userId = null;

    const result = await createComment(QUIZ_ID, 'Hola');

    expect(result).toEqual({ success: false, code: 'unauthorized', error: 'Sign in to comment.' });
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'x'.repeat(1001)])('devuelve invalid_input para body %j', async (body) => {
    const result = await createComment(QUIZ_ID, body);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it('devuelve invalid_input para un quizId que no es uuid', async () => {
    const result = await createComment('no-es-uuid', 'Hola');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it('devuelve rate_limited cuando el limiter rechaza y no inserta', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await createComment(QUIZ_ID, 'Hola');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('rate_limited');
    expect(mocks.limitCheck).toHaveBeenCalledWith('1.2.3.4');
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it('inserta con el user_id de la sesión y devuelve el comentario', async () => {
    const result = await createComment(QUIZ_ID, '  Hola  ');

    expect(mocks.insertSpy).toHaveBeenCalledWith({
      quiz_id: QUIZ_ID,
      user_id: 'user-1',
      body: 'Hola',
    });
    expect(result).toEqual({ success: true, comment: ROW });
  });
});

describe('getQuizComments', () => {
  beforeEach(() => {
    mocks.selectResult = { data: [ROW], error: null };
  });

  it('devuelve los comentarios mapeados', async () => {
    expect(await getQuizComments(QUIZ_ID)).toEqual([ROW]);
  });

  it('devuelve lista vacía si Supabase falla', async () => {
    mocks.selectResult = { data: null, error: { message: 'boom' } };

    expect(await getQuizComments(QUIZ_ID)).toEqual([]);
  });

  it('devuelve lista vacía para un quizId que no es uuid', async () => {
    expect(await getQuizComments('no-es-uuid')).toEqual([]);
  });
});
