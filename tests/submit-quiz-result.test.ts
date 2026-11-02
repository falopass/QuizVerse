import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  insertSpy: vi.fn(),
  insertError: null as { message: string } | null,
  rpc: vi.fn(),
  limitCheck: vi.fn(),
  headerList: new Map<string, string>(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
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
          return { data: null, error: mocks.insertError };
        },
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

vi.mock('@/lib/quiz/achievements', () => ({ checkAchievements: async () => [] }));

import { submitQuizResult } from '@/actions/quiz.actions';

const QUIZ_ID = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

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
  mocks.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
  mocks.headerList = new Map([['cf-connecting-ip', '203.0.113.9']]);
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
