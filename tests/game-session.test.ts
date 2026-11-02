import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  rpcResult: { data: null as unknown, error: null as { code?: string; message?: string } | null },
  tableResult: { data: null as unknown, error: null as { message?: string } | null },
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => client()),
}));

function client() {
  mocks.rpc.mockImplementation(() => ({ maybeSingle: async () => mocks.rpcResult }));
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'game_sessions') throw new Error(`tabla inesperada: ${table}`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => mocks.tableResult,
        }),
      }),
    };
  });
  return { rpc: mocks.rpc, from: mocks.from } as unknown as Parameters<
    typeof fetchSessionByShareToken
  >[0];
}

import { fetchSessionByShareToken } from '@/lib/data/game-session';
import { getChallengeForQuiz } from '@/lib/data/challenge';

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockReset();
  mocks.rpcResult = { data: null, error: null };
  mocks.tableResult = { data: null, error: null };
});

const sessionRow = {
  id: 's-1',
  quiz_id: 'quiz-1',
  score: 6,
  max_score: 8,
  percentage: 75,
  result_id: null,
  result_title: null,
  time_taken_seconds: 42,
  answers: [],
  share_token: 'tok',
  was_shared: false,
  completed_at: '2026-01-01T00:00:00Z',
  attempt_id: null,
};

const missingFunction = {
  code: 'PGRST202',
  message: 'Could not find the function public.get_session_by_share_token in the schema cache',
};

describe('fetchSessionByShareToken', () => {
  it('lee por el RPC y expone la fila sin player_id', async () => {
    mocks.rpcResult = { data: sessionRow, error: null };

    const row = await fetchSessionByShareToken(client(), 'tok');

    expect(mocks.rpc).toHaveBeenCalledWith('get_session_by_share_token', { p_token: 'tok' });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(row).toEqual({ ...sessionRow, player_id: null, attempt_id: null });
  });

  it('cae al SELECT directo cuando la función aún no existe', async () => {
    mocks.rpcResult = { data: null, error: missingFunction };
    mocks.tableResult = { data: { ...sessionRow, player_id: 'u-9' }, error: null };

    const row = await fetchSessionByShareToken(client(), 'tok');

    expect(mocks.from).toHaveBeenCalledWith('game_sessions');
    expect(row?.player_id).toBe('u-9');
  });

  it('devuelve null si el RPC falla por otra causa, sin tocar la tabla', async () => {
    mocks.rpcResult = { data: null, error: { message: 'timeout' } };

    const row = await fetchSessionByShareToken(client(), 'tok');

    expect(row).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('devuelve null si el fallback también falla', async () => {
    mocks.rpcResult = { data: null, error: missingFunction };
    mocks.tableResult = { data: null, error: { message: 'boom' } };

    expect(await fetchSessionByShareToken(client(), 'tok')).toBeNull();
  });
});

describe('getChallengeForQuiz', () => {
  it('resuelve el marcador cuando el token pertenece al quiz', async () => {
    mocks.rpcResult = { data: { ...sessionRow, result_title: 'El Narrador' }, error: null };

    const challenge = await getChallengeForQuiz('tok', 'quiz-1');

    expect(challenge).toEqual({
      token: 'tok',
      score: 6,
      maxScore: 8,
      resultTitle: 'El Narrador',
    });
  });

  it('rechaza un token de otro quiz', async () => {
    mocks.rpcResult = { data: sessionRow, error: null };

    expect(await getChallengeForQuiz('tok', 'otro-quiz')).toBeNull();
  });

  it('también filtra por quiz en el camino anterior a la migración', async () => {
    mocks.rpcResult = { data: null, error: missingFunction };
    mocks.tableResult = { data: sessionRow, error: null };

    expect(await getChallengeForQuiz('tok', 'quiz-1')).toMatchObject({ score: 6 });
    expect(await getChallengeForQuiz('tok', 'otro-quiz')).toBeNull();
  });
});
