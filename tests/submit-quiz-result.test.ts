import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbError = { message: string; code?: string };

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  insertSpy: vi.fn(),
  insertError: null as DbError | null,
  insertErrors: [] as DbError[],
  selectResult: { data: null as unknown, error: null as DbError | null },
  selectByIdResult: { data: null as unknown, error: null as DbError | null },
  rpc: vi.fn(),
  limitCheck: vi.fn(),
  headerList: new Map<string, string>(),
  verifyAttempt: vi.fn(),
  attemptsAvailable: false,
  attemptReveals: null as Record<string, string> | null,
  sessionIds: { id: 'derived-session-id', shareToken: 'derived-share-token' },
  checkAchievementsSpy: vi.fn(async () => []),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => mocks.headerList }));

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
      if (table !== 'game_sessions') throw new Error(`tabla inesperada: ${table}`);
      return {
        insert: async (payload: Record<string, unknown>) => {
          mocks.insertSpy(payload);
          const error = mocks.insertErrors.length ? mocks.insertErrors.shift() : mocks.insertError;
          return { data: null, error: error ?? null };
        },
        select: () => ({
          eq: (column: string) => ({
            maybeSingle: async () =>
              column === 'attempt_id' ? mocks.selectResult : mocks.selectByIdResult,
          }),
        }),
      };
    },
    rpc: mocks.rpc,
  }),
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({
  loadAnswerKeyByQuizId: async () => ({
    id: '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0',
    quiz_type: 'trivia',
    results: [],
    questions: [
      {
        id: 'q1',
        question: '¿Capital de Chile?',
        options: [
          { id: 'a', text: 'Santiago', is_correct: true },
          { id: 'b', text: 'Lima', is_correct: false },
        ],
      },
      {
        id: 'q2',
        question: '¿Capital de Argentina?',
        options: [
          { id: 'a', text: 'Buenos Aires', is_correct: true },
          { id: 'b', text: 'Córdoba', is_correct: false },
        ],
      },
    ],
  }),
}));

vi.mock('@/lib/quiz/achievements', () => ({
  checkAchievements: mocks.checkAchievementsSpy,
}));

vi.mock('@/lib/quiz/attempt', () => ({
  createQuizAttempt: vi.fn(),
  verifyQuizAttempt: mocks.verifyAttempt,
  sessionIdsForAttempt: async () => mocks.sessionIds,
  attemptsAvailable: () => mocks.attemptsAvailable,
}));

vi.mock('@/lib/quiz/attempt-store', () => ({
  getAttemptReveals: async () => mocks.attemptReveals,
}));

import { submitQuizResult } from '@/actions/quiz.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';
const ATTEMPT = 'signed-attempt-token';
const ATTEMPT_ID = 'attempt-1';

const ALL_CORRECT = [
  { question_id: 'q1', selected_option_id: 'a' },
  { question_id: 'q2', selected_option_id: 'a' },
];

const ONE_WRONG = [
  { question_id: 'q1', selected_option_id: 'a' },
  { question_id: 'q2', selected_option_id: 'b' },
];

beforeEach(() => {
  mocks.userId = null;
  mocks.insertSpy.mockClear();
  mocks.insertError = null;
  mocks.insertErrors = [];
  mocks.selectResult = { data: null, error: null };
  mocks.selectByIdResult = { data: null, error: null };
  mocks.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.headerList = new Map([['cf-connecting-ip', '203.0.113.9']]);
  mocks.verifyAttempt.mockReset().mockResolvedValue({
    ok: true,
    attempt: {
      quizId: QUIZ_ID,
      attemptId: ATTEMPT_ID,
      issuedAt: 1_700_000_000,
      expiresAt: 1_800_000_000,
    },
  });
  mocks.attemptReveals = null;
  mocks.attemptsAvailable = false;
  mocks.sessionIds = { id: 'derived-session-id', shareToken: 'derived-share-token' };
  mocks.checkAchievementsSpy.mockClear();
});

describe('submitQuizResult', () => {
  it('clavea el limiter por IP del cliente para anónimos, no con "anonymous"', async () => {
    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT);

    expect(result.success).toBe(true);
    expect(mocks.limitCheck).toHaveBeenCalledWith('anonymous:203.0.113.9');
    expect(mocks.limitCheck).not.toHaveBeenCalledWith('anonymous');
  });

  it('usa el id del usuario autenticado como clave del limiter', async () => {
    mocks.userId = 'user-7';

    await submitQuizResult(QUIZ_ID, ALL_CORRECT);

    expect(mocks.limitCheck).toHaveBeenCalledWith('user-7');
  });

  it('cae al fallback cuando no hay cabeceras de IP', async () => {
    mocks.headerList = new Map();

    await submitQuizResult(QUIZ_ID, ALL_CORRECT);

    expect(mocks.limitCheck).toHaveBeenCalledWith('anonymous:unknown');
  });

  it('inserta la sesión con player_id null y el marcador del servidor', async () => {
    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT);

    expect(result.success).toBe(true);
    expect(mocks.insertSpy).toHaveBeenCalledTimes(1);
    expect(mocks.insertSpy.mock.calls[0][0]).toMatchObject({
      quiz_id: QUIZ_ID,
      player_id: null,
      score: 2,
      max_score: 2,
    });
  });

  it('genera id y share_token en la acción y los devuelve sin leer la fila', async () => {
    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10);

    expect(result.success).toBe(true);
    const payload = mocks.insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.share_token).toMatch(/^[0-9a-f]{16}$/);

    // La respuesta devuelve exactamente lo que se insertó: nada depende de
    // leer la fila, que la policy nueva no dejaría ver a un anónimo.
    if (result.success) {
      expect(result.session).toEqual({ id: payload.id, share_token: payload.share_token });
    }
  });

  it('guarda player_id cuando hay sesión y sigue llamando a increment_plays', async () => {
    mocks.userId = 'u-1';

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10);

    expect(result.success).toBe(true);
    const payload = mocks.insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.player_id).toBe('u-1');
    expect(mocks.rpc).toHaveBeenCalledWith('increment_plays', { quiz_uuid: QUIZ_ID });
  });

  it('devuelve points_earned del trigger para autenticados: 35 perfecta, 10 normal', async () => {
    mocks.userId = 'u-pts';

    const perfect = await submitQuizResult(QUIZ_ID, ALL_CORRECT);
    expect(perfect.success).toBe(true);
    if (perfect.success) expect(perfect.points_earned).toBe(35);

    const normal = await submitQuizResult(QUIZ_ID, ONE_WRONG);
    expect(normal.success).toBe(true);
    if (normal.success) expect(normal.points_earned).toBe(10);
  });

  it('reporta 0 puntos en partidas anónimas (el trigger no otorga nada)', async () => {
    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT);

    expect(result.success).toBe(true);
    if (result.success) expect(result.points_earned).toBe(0);
  });

  it('la partida no se rompe si increment_plays queda denegado', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10);

    expect(result.success).toBe(true);
  });

  it('devuelve la revisión graduada en el servidor', async () => {
    const result = await submitQuizResult(QUIZ_ID, ONE_WRONG);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.review).toHaveLength(2);
    expect(result.review[0]).toMatchObject({
      questionId: 'q1',
      isCorrect: true,
      selectedOptionText: 'Santiago',
      correctOptionText: 'Santiago',
    });
    expect(result.review[1]).toMatchObject({
      questionId: 'q2',
      isCorrect: false,
      selectedOptionText: 'Córdoba',
      correctOptionText: 'Buenos Aires',
    });
  });

  it('no inserta nada cuando el limiter rechaza el envío', async () => {
    mocks.limitCheck.mockResolvedValue({ allowed: false });

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('rate_limited');
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it('rechaza cuando el insert falla', async () => {
    mocks.insertError = { message: 'db down' };

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10);

    expect(result.success).toBe(false);
  });
});

describe('submitQuizResult · idempotencia por attempt', () => {
  it('un segundo envío del mismo attempt devuelve la sesión existente sin insertar', async () => {
    mocks.userId = 'u-1';
    mocks.selectResult = {
      data: {
        id: 'session-1',
        share_token: 'share-1',
        player_id: 'u-1',
        score: 2,
        max_score: 2,
        result_id: null,
        result_title: null,
        answers: [
          { question_id: 'q1', selected_option_id: 'a', is_correct: true },
          { question_id: 'q2', selected_option_id: 'a', is_correct: true },
        ],
      },
      error: null,
    };

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.session).toEqual({ id: 'session-1', share_token: 'share-1' });
    expect(result.score).toBe(2);
    // El trigger ya pagó 35 en el primer envío: el reintento no los suma otra
    // vez, pero la pantalla debe enseñar los puntos reales de la partida.
    expect(result.points_earned).toBe(35);
    expect(mocks.insertSpy).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.checkAchievementsSpy).toHaveBeenCalledWith('u-1', { perfectScore: true });
  });

  it('un envío repetido de una partida anónima sigue reportando 0 puntos', async () => {
    mocks.selectResult = {
      data: {
        id: 'session-2',
        share_token: 'share-2',
        player_id: null,
        score: 2,
        max_score: 2,
        result_id: null,
        result_title: null,
        answers: [],
      },
      error: null,
    };

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.points_earned).toBe(0);
    expect(result.achievements_unlocked).toEqual([]);
    expect(mocks.checkAchievementsSpy).not.toHaveBeenCalled();
  });

  it('con secreto, un envío autenticado sin attempt se guarda anónimo y sin puntos', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.attemptsAvailable = true;
    mocks.userId = 'u-sin-token';

    try {
      const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.points_earned).toBe(0);
      expect(result.achievements_unlocked).toEqual([]);
      const payload = mocks.insertSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.player_id).toBeNull();
      expect(payload).not.toHaveProperty('attempt_id');
      expect(mocks.checkAchievementsSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sin attempt'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('con secreto, un attempt inválido tampoco otorga puntos', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.attemptsAvailable = true;
    mocks.userId = 'u-token-malo';
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'expired' });

    try {
      const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.points_earned).toBe(0);
      const payload = mocks.insertSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.player_id).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('deduplica por el índice único cuando la RLS no deja leer la fila', async () => {
    mocks.insertErrors = [{ code: '23505', message: 'duplicate key value' }];

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.session).toEqual({
      id: 'derived-session-id',
      share_token: 'derived-share-token',
    });
    expect(result.points_earned).toBe(0);
    expect(mocks.insertSpy).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('no infiere puntos ni logros si el conflicto no deja leer la fila', async () => {
    mocks.userId = 'u-late';
    mocks.insertErrors = [{ code: '23505', message: 'duplicate key value' }];

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    // La partida pudo guardarse anónima antes de iniciar sesión: el trigger no
    // pagó puntos y los logros no son de esta identidad.
    expect(result.points_earned).toBe(0);
    expect(result.achievements_unlocked).toEqual([]);
    expect(mocks.checkAchievementsSpy).not.toHaveBeenCalled();
  });

  it('sin migración, el reintento recupera la sesión por su id determinista', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.userId = 'u-1';
    mocks.selectResult = {
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'attempt_id' column of 'game_sessions' in the schema cache",
      },
    };
    mocks.selectByIdResult = {
      data: {
        id: 'derived-session-id',
        share_token: 'derived-share-token',
        player_id: 'u-1',
        score: 2,
        max_score: 2,
        result_id: null,
        result_title: null,
        answers: [],
      },
      error: null,
    };

    try {
      const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

      expect(result.success).toBe(true);
      if (!result.success) return;
      // El trigger ya pagó 35 en el primer INSERT; la fila se recupera por id
      // aunque la columna attempt_id todavía no exista.
      expect(result.points_earned).toBe(35);
      expect(mocks.insertSpy).not.toHaveBeenCalled();
      expect(mocks.checkAchievementsSpy).toHaveBeenCalledWith('u-1', { perfectScore: true });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('sin la migración 019 detecta la columna ausente y guarda sin attempt_id', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.insertErrors = [
      {
        code: 'PGRST204',
        message: "Could not find the 'attempt_id' column of 'game_sessions' in the schema cache",
      },
    ];

    try {
      const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

      expect(result.success).toBe(true);
      expect(mocks.insertSpy).toHaveBeenCalledTimes(2);
      expect(mocks.insertSpy.mock.calls[0][0]).toMatchObject({ attempt_id: ATTEMPT_ID });
      expect(mocks.insertSpy.mock.calls[1][0]).not.toHaveProperty('attempt_id');
      // El aviso se emite una sola vez por proceso: otro caso de este archivo
      // pudo dispararlo antes, así que no se asserta aquí.
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('un attempt inválido no bloquea el envío: se guarda como antes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.verifyAttempt.mockResolvedValue({ ok: false, reason: 'bad_signature' });

    try {
      const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

      expect(result.success).toBe(true);
      expect(mocks.insertSpy).toHaveBeenCalledTimes(1);
      expect(mocks.insertSpy.mock.calls[0][0]).not.toHaveProperty('attempt_id');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('bad_signature'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('la opción revelada manda sobre la opción enviada', async () => {
    mocks.attemptReveals = { q2: 'b' };

    const result = await submitQuizResult(QUIZ_ID, ALL_CORRECT, 10, ATTEMPT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.score).toBe(1);
    const payload = mocks.insertSpy.mock.calls[0][0] as {
      answers: Array<{ question_id: string; selected_option_id: string }>;
    };
    expect(payload.answers[1]).toMatchObject({ question_id: 'q2', selected_option_id: 'b' });
  });
});
