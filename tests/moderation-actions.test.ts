import { beforeEach, describe, expect, it, vi } from 'vitest';

type Filter = [string, unknown];
interface Call {
  table: string;
  op: 'select' | 'update';
  payload?: unknown;
  filters: Filter[];
}

const { state, supabaseStub, revalidate } = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    isAdmin: false,
    quizRow: null as {
      id: string;
      slug: string;
      language: string;
      status: string;
    } | null,
    moderateResult: { data: null, error: null } as {
      data: { id: string }[] | null;
      error: { message: string; code?: string } | null;
    },
    writeError: null as { message: string } | null,
    calls: [] as Call[],
  };
  const revalidate = vi.fn();

  // Builders de la cadena PostgREST que usan las acciones de moderación:
  // update().eq().eq() (awaitable) y update().eq().eq().select() (returning).
  function updateBuilder(table: string, payload: unknown) {
    const call: Call = { table, op: 'update', payload, filters: [] };
    state.calls.push(call);
    const node = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return node;
      },
      in(column: string, values: unknown) {
        call.filters.push([column, values]);
        return node;
      },
      select: async () =>
        table === 'quizzes' ? state.moderateResult : { data: [], error: state.writeError },
      then(
        onFulfilled?: (value: { error: unknown }) => unknown,
        onRejected?: (e: unknown) => unknown
      ) {
        return Promise.resolve({ error: state.writeError }).then(onFulfilled, onRejected);
      },
    };
    return node;
  }

  const supabaseStub = {
    from: (table: string) => ({
      select: () => {
        const call: Call = { table, op: 'select', filters: [] };
        state.calls.push(call);
        return {
          eq(column: string, value: unknown) {
            call.filters.push([column, value]);
            return this;
          },
          maybeSingle: async () => ({ data: state.quizRow, error: null }),
        };
      },
      update: (payload: unknown) => updateBuilder(table, payload),
    }),
  };

  return { state, supabaseStub, revalidate };
});

vi.mock('next/cache', () => ({ revalidatePath: revalidate }));

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: async () => ({
    supabase: supabaseStub,
    user: state.user,
    isAdmin: state.isAdmin,
  }),
}));

import { publishQuiz, rejectQuiz, resolveQuizReport } from '@/actions/moderation.actions';

const REPORT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
/** UUIDs válidos para el caso de más de 50 reportes. */
const manyReportIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `3f8a2c5e-9b1d-4e7f-a2c3-${String(i).padStart(12, '0')}`);
const PENDING_QUIZ = { id: QUIZ_ID, slug: 'quiz-de-prueba', language: 'en', status: 'pending' };

const callsTo = (table: string, op: Call['op']) =>
  state.calls.filter((call) => call.table === table && call.op === op);

beforeEach(() => {
  state.user = { id: 'admin-1' };
  state.isAdmin = true;
  state.quizRow = { ...PENDING_QUIZ };
  state.moderateResult = { data: [{ id: QUIZ_ID }], error: null };
  state.writeError = null;
  state.calls = [];
  revalidate.mockClear();
});

describe('resolveQuizReport', () => {
  it('rejects a non-uuid report id before touching auth', async () => {
    const result = await resolveQuizReport('not-a-uuid');
    expect(result).toMatchObject({ success: false, code: 'invalid_input' });
    expect(state.calls).toHaveLength(0);
  });

  it('returns unauthorized when there is no session', async () => {
    state.user = null;
    const result = await resolveQuizReport(REPORT_ID);
    expect(result).toMatchObject({ success: false, code: 'unauthorized' });
    expect(state.calls).toHaveLength(0);
  });

  it('returns forbidden for a signed-in non-admin', async () => {
    state.user = { id: 'user-1' };
    state.isAdmin = false;
    const result = await resolveQuizReport(REPORT_ID);
    expect(result).toMatchObject({ success: false, code: 'forbidden' });
    expect(state.calls).toHaveLength(0);
  });

  it('marks the report resolved by the admin', async () => {
    const result = await resolveQuizReport(REPORT_ID);
    expect(result).toEqual({ success: true });

    const [update] = callsTo('quiz_reports', 'update');
    expect(update.payload).toMatchObject({ resolved: true, resolved_by: 'admin-1' });
    expect(update.filters).toContainEqual(['id', REPORT_ID]);
    expect(update.filters).toContainEqual(['resolved', false]);
  });
});

describe('publishQuiz', () => {
  it('rejects a non-uuid quiz id before touching auth', async () => {
    expect(await publishQuiz('nope')).toMatchObject({ success: false, code: 'invalid_input' });
    expect(state.calls).toHaveLength(0);
  });

  it('returns unauthorized when there is no session', async () => {
    state.user = null;
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'unauthorized' });
  });

  it('returns forbidden for a signed-in non-admin', async () => {
    state.user = { id: 'user-1' };
    state.isAdmin = false;
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'forbidden' });
    expect(callsTo('quizzes', 'update')).toHaveLength(0);
  });

  it('returns not_found when the quiz is not visible to the admin', async () => {
    state.quizRow = null;
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'not_found' });
    expect(callsTo('quizzes', 'update')).toHaveLength(0);
  });

  it('is a no-op when the quiz is already published', async () => {
    state.quizRow = { ...PENDING_QUIZ, status: 'published' };
    expect(await publishQuiz(QUIZ_ID)).toEqual({ success: true });
    expect(callsTo('quizzes', 'update')).toHaveLength(0);
  });

  it('can republish a rejected quiz (appeal)', async () => {
    state.quizRow = { ...PENDING_QUIZ, status: 'rejected' };
    expect(await publishQuiz(QUIZ_ID)).toEqual({ success: true });
    expect(callsTo('quizzes', 'update')[0].filters).toContainEqual(['status', 'rejected']);
  });

  it.each(['archived', 'draft'])('refuses to publish a %s quiz', async (status) => {
    state.quizRow = { ...PENDING_QUIZ, status };
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'conflict' });
    expect(callsTo('quizzes', 'update')).toHaveLength(0);
  });

  it('publishes a pending quiz with audit fields and CAS on the prior status', async () => {
    const result = await publishQuiz(QUIZ_ID);
    expect(result).toEqual({ success: true });

    const [update] = callsTo('quizzes', 'update');
    expect(update.payload).toMatchObject({
      status: 'published',
      moderated_by: 'admin-1',
      moderation_note: null,
    });
    expect(typeof (update.payload as Record<string, unknown>).moderated_at).toBe('string');
    expect(typeof (update.payload as Record<string, unknown>).published_at).toBe('string');
    expect(update.filters).toContainEqual(['id', QUIZ_ID]);
    expect(update.filters).toContainEqual(['status', 'pending']);
  });

  it('resolves only the reports the ficha showed, validated against the quiz', async () => {
    await publishQuiz(QUIZ_ID, [REPORT_ID]);
    const [update] = callsTo('quiz_reports', 'update');
    expect(update.payload).toMatchObject({ resolved: true, resolved_by: 'admin-1' });
    expect(update.filters).toContainEqual(['id', [REPORT_ID]]);
    expect(update.filters).toContainEqual(['quiz_id', QUIZ_ID]);
    expect(update.filters).toContainEqual(['resolved', false]);
  });

  it('touches no reports when the ficha showed none', async () => {
    await publishQuiz(QUIZ_ID);
    expect(callsTo('quiz_reports', 'update')).toHaveLength(0);
  });

  it('closes all 60 shown reports when there are more than 50 (no cap, no extras)', async () => {
    const ids = manyReportIds(60);
    await publishQuiz(QUIZ_ID, ids);
    const [update] = callsTo('quiz_reports', 'update');
    expect(update.filters).toContainEqual(['id', ids]);
    expect(update.filters).toContainEqual(['quiz_id', QUIZ_ID]);
    // Sin filtro global por quiz_id suelto: solo los IDs mostrados.
    expect(update.filters.filter(([column]) => column === 'id')).toHaveLength(1);
  });

  it('batches report resolution so a quiz with hundreds of reports stays moderable', async () => {
    const ids = manyReportIds(250);
    await publishQuiz(QUIZ_ID, ids);
    const updates = callsTo('quiz_reports', 'update');
    expect(updates).toHaveLength(3);
    const chunkSizes = updates.map(
      (update) => (update.filters.find(([column]) => column === 'id')?.[1] as string[]).length
    );
    expect(chunkSizes).toEqual([100, 100, 50]);
    for (const update of updates) {
      expect(update.filters).toContainEqual(['quiz_id', QUIZ_ID]);
      expect(update.filters).toContainEqual(['resolved', false]);
    }
  });

  it('rejects invalid report ids before touching the database', async () => {
    expect(await publishQuiz(QUIZ_ID, ['no-es-uuid'])).toMatchObject({
      success: false,
      code: 'invalid_input',
    });
    expect(state.calls).toHaveLength(0);
  });

  it('revalidates the catalog pages and feeds of the quiz locale', async () => {
    await publishQuiz(QUIZ_ID);
    expect(revalidate).toHaveBeenCalledWith('/en');
    expect(revalidate).toHaveBeenCalledWith('/en/quiz');
    expect(revalidate).toHaveBeenCalledWith('/en/quiz/quiz-de-prueba');
    expect(revalidate).toHaveBeenCalledWith('/en/feed.xml');
    expect(revalidate).toHaveBeenCalledWith('/api/sitemap');
  });

  it('returns conflict when the update touches zero rows (state moved or policy missing)', async () => {
    state.moderateResult = { data: [], error: null };
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'conflict' });
  });

  it('returns unexpected on a database error', async () => {
    state.moderateResult = { data: null, error: { message: 'boom' } };
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'unexpected' });
  });

  it('returns conflict on PGRST204 (moderation columns missing, migration 016 not applied)', async () => {
    state.moderateResult = {
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'moderated_by' column" },
    };
    expect(await publishQuiz(QUIZ_ID)).toMatchObject({ success: false, code: 'conflict' });
  });
});

describe('rejectQuiz', () => {
  it('requires a reason of at least 3 characters', async () => {
    for (const reason of ['', '  ', 'ok']) {
      expect(await rejectQuiz(QUIZ_ID, reason)).toMatchObject({
        success: false,
        code: 'invalid_input',
      });
    }
    expect(callsTo('quizzes', 'update')).toHaveLength(0);
  });

  it('returns forbidden for a signed-in non-admin', async () => {
    state.isAdmin = false;
    expect(await rejectQuiz(QUIZ_ID, 'contenido inapropiado')).toMatchObject({
      success: false,
      code: 'forbidden',
    });
  });

  it('rejects a pending quiz with the reason as moderation note', async () => {
    const result = await rejectQuiz(QUIZ_ID, 'factual errors in questions 3 and 7');
    expect(result).toEqual({ success: true });

    const [update] = callsTo('quizzes', 'update');
    expect(update.payload).toMatchObject({
      status: 'rejected',
      moderated_by: 'admin-1',
      moderation_note: 'factual errors in questions 3 and 7',
    });
    expect(update.payload).not.toHaveProperty('published_at');
  });

  it('can take down a published quiz (takedown of reported content)', async () => {
    state.quizRow = { ...PENDING_QUIZ, status: 'published' };
    const result = await rejectQuiz(QUIZ_ID, 'spam confirmado');
    expect(result).toEqual({ success: true });
    const [update] = callsTo('quizzes', 'update');
    expect(update.filters).toContainEqual(['status', 'published']);
  });

  it('can reject an archived quiz — resolves its reports without republishing', async () => {
    state.quizRow = { ...PENDING_QUIZ, status: 'archived' };
    const result = await rejectQuiz(QUIZ_ID, 'retiro confirmado');
    expect(result).toEqual({ success: true });
    const [update] = callsTo('quizzes', 'update');
    expect(update.filters).toContainEqual(['status', 'archived']);
    expect(update.payload).toMatchObject({ status: 'rejected' });
  });

  it('resolves only the reports the ficha showed on rejection', async () => {
    await rejectQuiz(QUIZ_ID, 'spam confirmado', [REPORT_ID]);
    const [update] = callsTo('quiz_reports', 'update');
    expect(update.filters).toContainEqual(['id', [REPORT_ID]]);
    expect(update.filters).toContainEqual(['quiz_id', QUIZ_ID]);
  });

  it('refuses to reject a draft (it never reached the queue)', async () => {
    state.quizRow = { ...PENDING_QUIZ, status: 'draft' };
    expect(await rejectQuiz(QUIZ_ID, 'motivo válido')).toMatchObject({
      success: false,
      code: 'conflict',
    });
    expect(callsTo('quizzes', 'update')).toHaveLength(0);
  });
});
