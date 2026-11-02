import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  insertSpy: vi.fn(),
  insertError: null as { message: string } | null,
  rpc: vi.fn(),
  limitCheck: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Map() }));

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
        insert: async (payload: unknown) => {
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
    id: '123e4567-e89b-42d3-a456-426614174000',
    quiz_type: 'trivia',
    results: null,
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
  }),
}));

vi.mock('@/lib/quiz/achievements', () => ({ checkAchievements: async () => [] }));

import { submitQuizResult } from '@/actions/quiz.actions';

const QUIZ_ID = '123e4567-e89b-42d3-a456-426614174000';
const ANSWERS = [{ question_id: 'q1', selected_option_id: 'a' }];

beforeEach(() => {
  mocks.userId = null;
  mocks.insertError = null;
  mocks.insertSpy.mockClear();
  mocks.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mocks.limitCheck.mockReset().mockResolvedValue({ allowed: true });
});

describe('submitQuizResult', () => {
  it('inserta la sesión sin RETURNING con id y share_token generados en la acción', async () => {
    const result = await submitQuizResult(QUIZ_ID, ANSWERS, 10);

    expect(result.success).toBe(true);
    const payload = mocks.insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      quiz_id: QUIZ_ID,
      player_id: null,
      score: 1,
      max_score: 1,
    });
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.share_token).toMatch(/^[0-9a-f]{16}$/);

    // La respuesta devuelve exactamente lo que se insertó: nada depende de
    // leer la fila, que la policy nueva no dejaría ver a un anónimo.
    if (result.success) {
      expect(result.session).toEqual({ id: payload.id, share_token: payload.share_token });
    }
  });

  it('guarda player_id cuando hay sesión y sigue llamando a increment_plays best-effort', async () => {
    mocks.userId = 'u-1';

    const result = await submitQuizResult(QUIZ_ID, ANSWERS, 10);

    expect(result.success).toBe(true);
    const payload = mocks.insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.player_id).toBe('u-1');
    expect(mocks.rpc).toHaveBeenCalledWith('increment_plays', { quiz_uuid: QUIZ_ID });
  });

  it('la partida no se rompe si increment_plays queda denegado', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const result = await submitQuizResult(QUIZ_ID, ANSWERS, 10);

    expect(result.success).toBe(true);
  });

  it('rechaza cuando el insert falla', async () => {
    mocks.insertError = { message: 'db down' };

    const result = await submitQuizResult(QUIZ_ID, ANSWERS, 10);

    expect(result.success).toBe(false);
  });
});
