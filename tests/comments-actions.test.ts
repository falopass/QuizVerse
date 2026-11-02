import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  requireAdmin: { user: null as { id: string } | null, isAdmin: false },
  insertSpy: vi.fn(),
  insertResult: { data: null as unknown, error: null as { message: string } | null },
  selectResult: {
    data: [] as unknown[] | null,
    count: 0 as number | null,
    error: null as { message: string } | null,
  },
  quizResult: { data: null as { id?: string; creator_id?: string } | null },
  profileResult: { data: null as { is_admin?: boolean } | null },
  commentRow: {
    data: null as { id: string; user_id: string; quiz_id: string; body: string } | null,
  },
  hiddenRows: { data: [] as { id: string; hidden_at: string }[] | null },
  deleteSpy: vi.fn(),
  deleteResult: { error: null as { message: string } | null },
  updateSpy: vi.fn(),
  updateResult: { error: null as { message: string } | null },
  reportInsertSpy: vi.fn(),
  reportInsertResult: { error: null as { message: string; code?: string } | null },
  reportUpdateSpy: vi.fn(),
  eqSpy: vi.fn(),
  limitCheck: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '1.2.3.4, 5.6.7.8']]),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: () => ({ check: mocks.limitCheck }),
}));

const commentsTableStub = () => ({
  select: () => ({
    eq: () => ({
      order: () => ({ limit: async () => mocks.selectResult }),
      maybeSingle: async () => mocks.commentRow,
      not: async () => ({ data: mocks.hiddenRows.data }),
    }),
  }),
  insert: (payload: unknown) => {
    mocks.insertSpy(payload);
    return { select: () => ({ single: async () => mocks.insertResult }) };
  },
  delete: () => {
    mocks.deleteSpy();
    return {
      eq: async (column: string, value: unknown) => {
        mocks.eqSpy(column, value);
        return mocks.deleteResult;
      },
    };
  },
  update: (payload: unknown) => {
    mocks.updateSpy(payload);
    return { eq: async () => mocks.updateResult };
  },
});

const quizzesTableStub = () => ({
  select: () => {
    const node = {
      eq: () => node,
      maybeSingle: async () => mocks.quizResult,
    };
    return node;
  },
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }),
    },
    from: (table: string) => {
      if (table === 'quizzes') return quizzesTableStub();
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => mocks.profileResult }) }),
        };
      }
      if (table === 'comment_reports') {
        return {
          insert: (payload: unknown) => {
            mocks.reportInsertSpy(payload);
            return Promise.resolve(mocks.reportInsertResult);
          },
        };
      }
      if (table !== 'quiz_comments') throw new Error(`unexpected table ${table}`);
      return commentsTableStub();
    },
  }),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: async () => ({
    supabase: {
      from: (table: string) => {
        if (table !== 'comment_reports') throw new Error(`unexpected table ${table}`);
        return {
          update: (payload: unknown) => {
            mocks.reportUpdateSpy(payload);
            return {
              eq: () => ({ eq: async () => mocks.reportInsertResult }),
            };
          },
        };
      },
    },
    user: mocks.requireAdmin.user,
    isAdmin: mocks.requireAdmin.isAdmin,
  }),
}));

import {
  createComment,
  deleteComment,
  getQuizComments,
  reportComment,
  resolveCommentReport,
  setCommentHidden,
} from '@/actions/comments.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
const COMMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const REPORT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const ROW = {
  id: 'comment-1',
  body: 'Buenísimo',
  created_at: '2026-10-19T00:00:00Z',
  user_id: 'user-1',
  hidden_at: null,
  author: { username: 'ada', display_name: 'Ada', avatar_url: null },
};

beforeEach(() => {
  mocks.userId = 'user-1';
  mocks.requireAdmin = { user: null, isAdmin: false };
  mocks.insertSpy.mockClear();
  mocks.deleteSpy.mockClear();
  mocks.updateSpy.mockClear();
  mocks.reportInsertSpy.mockClear();
  mocks.reportUpdateSpy.mockClear();
  mocks.eqSpy.mockClear();
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.insertResult = { data: ROW, error: null };
  mocks.selectResult = { data: [ROW], count: 1, error: null };
  mocks.quizResult = { data: { id: QUIZ_ID } };
  mocks.profileResult = { data: { is_admin: false } };
  mocks.commentRow = { data: { id: COMMENT_ID, user_id: 'user-1', quiz_id: QUIZ_ID, body: 'hey' } };
  mocks.hiddenRows = { data: [] };
  mocks.deleteResult = { error: null };
  mocks.updateResult = { error: null };
  mocks.reportInsertResult = { error: null };
});

describe('createComment', () => {
  it('devuelve unauthorized sin sesión y no inserta', async () => {
    mocks.userId = null;

    const result = await createComment(QUIZ_ID, 'Hola');

    expect(result).toEqual({
      success: false,
      code: 'unauthorized',
      error: 'Sign in to comment.',
    });
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

  it('devuelve not_found para un quiz no publicado o inexistente y no inserta', async () => {
    mocks.quizResult = { data: null };

    const result = await createComment(QUIZ_ID, 'Hola');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('not_found');
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
  it('devuelve los comentarios mapeados y el total real', async () => {
    expect(await getQuizComments(QUIZ_ID)).toEqual({
      comments: [ROW],
      total: 1,
      viewerCanModerate: false,
      viewerIsAdmin: false,
    });
  });

  it('marca los ocultos cuando quien mira es el creador del quiz', async () => {
    mocks.quizResult = { data: { id: QUIZ_ID, creator_id: 'user-1' } };
    mocks.hiddenRows = { data: [{ id: 'comment-1', hidden_at: '2026-10-20T00:00:00Z' }] };

    const page = await getQuizComments(QUIZ_ID);

    expect(page.viewerCanModerate).toBe(true);
    expect(page.comments[0].hidden_at).toBe('2026-10-20T00:00:00Z');
  });

  it('rechaza si Supabase falla, para que la ficha ofrezca reintento', async () => {
    mocks.selectResult = { data: null, count: null, error: { message: 'boom' } };

    await expect(getQuizComments(QUIZ_ID)).rejects.toMatchObject({ message: 'boom' });
  });

  it('devuelve página vacía para un quizId que no es uuid', async () => {
    expect(await getQuizComments('no-es-uuid')).toEqual({
      comments: [],
      total: 0,
      viewerCanModerate: false,
      viewerIsAdmin: false,
    });
  });
});

describe('deleteComment', () => {
  it('devuelve unauthorized sin sesión y no borra', async () => {
    mocks.userId = null;

    const result = await deleteComment(COMMENT_ID);

    expect(result).toMatchObject({ success: false, code: 'unauthorized' });
    expect(mocks.deleteSpy).not.toHaveBeenCalled();
  });

  it('devuelve invalid_input para un id que no es uuid', async () => {
    const result = await deleteComment('no-es-uuid');

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(mocks.deleteSpy).not.toHaveBeenCalled();
  });

  it('devuelve not_found si el comentario no existe o no es visible', async () => {
    mocks.commentRow = { data: null };

    const result = await deleteComment(COMMENT_ID);

    expect(result).toMatchObject({ success: false, code: 'not_found' });
    expect(mocks.deleteSpy).not.toHaveBeenCalled();
  });

  it('devuelve forbidden al intentar borrar un comentario ajeno', async () => {
    mocks.commentRow = {
      data: { id: COMMENT_ID, user_id: 'otro', quiz_id: QUIZ_ID, body: 'hey' },
    };

    const result = await deleteComment(COMMENT_ID);

    expect(result).toMatchObject({ success: false, code: 'forbidden' });
    expect(mocks.deleteSpy).not.toHaveBeenCalled();
  });

  it('borra el comentario propio', async () => {
    const result = await deleteComment(COMMENT_ID);

    expect(result).toEqual({ success: true });
    expect(mocks.deleteSpy).toHaveBeenCalledTimes(1);
    expect(mocks.eqSpy).toHaveBeenCalledWith('id', COMMENT_ID);
  });

  it('el admin borra un comentario ajeno', async () => {
    mocks.commentRow = {
      data: { id: COMMENT_ID, user_id: 'otro', quiz_id: QUIZ_ID, body: 'hey' },
    };
    mocks.profileResult = { data: { is_admin: true } };

    const result = await deleteComment(COMMENT_ID);

    expect(result).toEqual({ success: true });
    expect(mocks.deleteSpy).toHaveBeenCalledTimes(1);
  });
});

describe('setCommentHidden', () => {
  it('devuelve forbidden para alguien que no es creador ni admin', async () => {
    mocks.commentRow = {
      data: { id: COMMENT_ID, user_id: 'otro', quiz_id: QUIZ_ID, body: 'hey' },
    };
    mocks.quizResult = { data: { id: QUIZ_ID, creator_id: 'otro-mas' } };

    const result = await setCommentHidden(COMMENT_ID, true);

    expect(result).toMatchObject({ success: false, code: 'forbidden' });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it('el creador del quiz oculta un comentario y queda firmado', async () => {
    mocks.commentRow = {
      data: { id: COMMENT_ID, user_id: 'otro', quiz_id: QUIZ_ID, body: 'hey' },
    };
    mocks.quizResult = { data: { id: QUIZ_ID, creator_id: 'user-1' } };

    const result = await setCommentHidden(COMMENT_ID, true);

    expect(result.success).toBe(true);
    const payload = mocks.updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof payload.hidden_at).toBe('string');
    expect(payload.hidden_by).toBe('user-1');
  });

  it('el admin restaura un comentario limpiando las columnas', async () => {
    mocks.profileResult = { data: { is_admin: true } };
    mocks.quizResult = { data: { id: QUIZ_ID, creator_id: 'otro-mas' } };

    const result = await setCommentHidden(COMMENT_ID, false);

    expect(result).toEqual({ success: true, hiddenAt: null });
    expect(mocks.updateSpy).toHaveBeenCalledWith({ hidden_at: null, hidden_by: null });
  });
});

describe('reportComment', () => {
  it('devuelve unauthorized sin sesión y no inserta', async () => {
    mocks.userId = null;

    const result = await reportComment(COMMENT_ID, 'spam');

    expect(result).toMatchObject({ success: false, code: 'unauthorized' });
    expect(mocks.reportInsertSpy).not.toHaveBeenCalled();
  });

  it('devuelve invalid_input para un motivo fuera del enum', async () => {
    const result = await reportComment(COMMENT_ID, 'inventado');

    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(mocks.reportInsertSpy).not.toHaveBeenCalled();
  });

  it('devuelve rate_limited por usuario y no inserta', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await reportComment(COMMENT_ID, 'spam');

    expect(result).toMatchObject({ success: false, code: 'rate_limited' });
    expect(mocks.limitCheck).toHaveBeenCalledWith('user-1');
    expect(mocks.reportInsertSpy).not.toHaveBeenCalled();
  });

  it('devuelve not_found si el comentario no es visible y no inserta', async () => {
    mocks.commentRow = { data: null };

    const result = await reportComment(COMMENT_ID, 'spam');

    expect(result).toMatchObject({ success: false, code: 'not_found' });
    expect(mocks.reportInsertSpy).not.toHaveBeenCalled();
  });

  it('inserta el reporte con copia del cuerpo y del quiz', async () => {
    mocks.commentRow = {
      data: { id: COMMENT_ID, user_id: 'otro', quiz_id: QUIZ_ID, body: 'texto feo' },
    };

    const result = await reportComment(COMMENT_ID, 'hate_speech', '  detalle  ');

    expect(result).toEqual({ success: true });
    expect(mocks.reportInsertSpy).toHaveBeenCalledWith({
      comment_id: COMMENT_ID,
      quiz_id: QUIZ_ID,
      comment_body: 'texto feo',
      reporter_id: 'user-1',
      reason: 'hate_speech',
      details: 'detalle',
    });
  });

  it('devuelve conflict cuando ya hay un reporte abierto del mismo usuario', async () => {
    mocks.reportInsertResult = { error: { code: '23505', message: 'duplicate' } };

    const result = await reportComment(COMMENT_ID, 'spam');

    expect(result).toMatchObject({ success: false, code: 'conflict' });
  });
});

describe('resolveCommentReport', () => {
  it('devuelve unauthorized sin sesión', async () => {
    const result = await resolveCommentReport(REPORT_ID);

    expect(result).toMatchObject({ success: false, code: 'unauthorized' });
    expect(mocks.reportUpdateSpy).not.toHaveBeenCalled();
  });

  it('devuelve forbidden para un usuario con sesión que no es admin', async () => {
    mocks.requireAdmin = { user: { id: 'user-1' }, isAdmin: false };

    const result = await resolveCommentReport(REPORT_ID);

    expect(result).toMatchObject({ success: false, code: 'forbidden' });
    expect(mocks.reportUpdateSpy).not.toHaveBeenCalled();
  });

  it('el admin marca el reporte como revisado', async () => {
    mocks.requireAdmin = { user: { id: 'admin-1' }, isAdmin: true };

    const result = await resolveCommentReport(REPORT_ID);

    expect(result).toEqual({ success: true });
    const payload = mocks.reportUpdateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.resolved).toBe(true);
    expect(payload.resolved_by).toBe('admin-1');
    expect(typeof payload.resolved_at).toBe('string');
  });
});
