import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })),
}));

import { getWeeklyLeaderboard, getWeeklyRank } from '@/lib/profile/weekly-ranking';

type DbResult = { data: unknown; error: unknown };
type Call = { method: string; args: unknown[] };

/** Builder thenable mínimo que registra cada método encadenado. */
function tableResult(result: DbResult, calls: Call[]) {
  const builder: Record<string, unknown> & { then: (resolve: (v: DbResult) => void) => void } = {
    then: (resolve) => resolve(result),
  };
  for (const method of ['select', 'eq', 'gte', 'not', 'in', 'order', 'limit', 'range']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  return builder;
}

function profileRow(id: string) {
  return {
    id,
    username: `user-${id}`,
    display_name: `Jugador ${id}`,
    avatar_url: null,
    bio: null,
    points: 0,
    quizzes_played: 0,
    quizzes_created: 0,
    is_admin: false,
    is_verified: false,
    preferred_language: 'es',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const ok = (data: unknown): DbResult => ({ data, error: null });
const fail = (): DbResult => ({ data: null, error: new Error('boom') });

/**
 * Enchufa el mock de `from()` y devuelve las llamadas por tabla.
 * `sessionPages` se consume página a página: cada `from('game_sessions')`
 * resuelve la siguiente, o `{data: []}` si ya no quedan.
 */
function mockDb({ sessionPages, profiles }: { sessionPages: DbResult[]; profiles: DbResult }) {
  const calls: Record<'game_sessions' | 'profiles', Call[]> = {
    game_sessions: [],
    profiles: [],
  };
  const pages = [...sessionPages];
  mocks.from.mockImplementation((table: string) => {
    if (table === 'game_sessions') {
      return tableResult(pages.shift() ?? ok([]), calls.game_sessions);
    }
    if (table === 'profiles') {
      return tableResult(profiles, calls.profiles);
    }
    throw new Error(`tabla inesperada: ${table}`);
  });
  return calls;
}

/** El RPC no existe hasta aplicar la migración: ese es el camino por defecto. */
const MISSING_FUNCTION = {
  code: 'PGRST202',
  message: 'Could not find the function in the schema cache',
};

beforeEach(() => {
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ data: null, error: MISSING_FUNCTION });
});

describe('getWeeklyLeaderboard', () => {
  it('agrega dos sesiones del mismo jugador con la fórmula del trigger', async () => {
    mockDb({
      sessionPages: [
        ok([
          { player_id: 'u1', score: 10, max_score: 10 }, // perfecta: 35
          { player_id: 'u1', score: 4, max_score: 10 }, // normal: 10
          { player_id: 'u2', score: 10, max_score: 10 }, // perfecta: 35
        ]),
      ],
      profiles: ok([profileRow('u1'), profileRow('u2')]),
    });

    const { entries } = await getWeeklyLeaderboard(50);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ rank: 1, points: 45, quizzesPlayed: 2 });
    expect(entries[0].user.username).toBe('user-u1');
    expect(entries[1]).toMatchObject({ rank: 2, points: 35, quizzesPlayed: 1 });
  });

  it('filtra en la query la ventana de 7 días y los player_id nulos', async () => {
    const calls = mockDb({
      sessionPages: [
        ok([
          { player_id: null, score: 10, max_score: 10 }, // defensa: aunque llegara, se salta
          { player_id: 'u1', score: 3, max_score: 10 },
        ]),
      ],
      profiles: ok([profileRow('u1')]),
    });

    const { entries } = await getWeeklyLeaderboard(50);

    expect(entries).toHaveLength(1);
    expect(entries[0].quizzesPlayed).toBe(1);

    expect(calls.game_sessions).toContainEqual({
      method: 'not',
      args: ['player_id', 'is', null],
    });
    const gte = calls.game_sessions.find((call) => call.method === 'gte');
    expect(gte?.args[0]).toBe('completed_at');
    const since = new Date(gte?.args[1] as string).getTime();
    const expectedSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(since - expectedSince)).toBeLessThan(10_000);
  });

  it('barre todas las páginas de la semana, no solo la primera', async () => {
    const fullPage = Array.from({ length: 1000 }, () => ({
      player_id: 'u1',
      score: 1,
      max_score: 10,
    }));
    const calls = mockDb({
      sessionPages: [ok(fullPage), ok([{ player_id: 'u2', score: 10, max_score: 10 }])],
      profiles: ok([profileRow('u1'), profileRow('u2')]),
    });

    const { entries } = await getWeeklyLeaderboard(50);

    const ranges = calls.game_sessions.filter((call) => call.method === 'range');
    expect(ranges).toEqual([
      { method: 'range', args: [0, 999] },
      { method: 'range', args: [1000, 1999] },
    ]);
    expect(calls.game_sessions).toContainEqual({ method: 'order', args: ['id'] });
    expect(entries[0]).toMatchObject({ rank: 1, quizzesPlayed: 1000 });
    expect(entries[1]).toMatchObject({ rank: 2, quizzesPlayed: 1 });
  });

  it('respeta el limit y solo pide los perfiles del top', async () => {
    const calls = mockDb({
      sessionPages: [
        ok([
          { player_id: 'u1', score: 1, max_score: 10 },
          { player_id: 'u2', score: 1, max_score: 10 },
          { player_id: 'u3', score: 1, max_score: 10 },
        ]),
      ],
      profiles: ok([profileRow('u1'), profileRow('u2')]),
    });

    const { entries } = await getWeeklyLeaderboard(2);

    expect(entries).toHaveLength(2);
    const inCall = calls.profiles.find((call) => call.method === 'in');
    expect(inCall?.args[0]).toBe('id');
    expect(inCall?.args[1]).toHaveLength(2);
  });

  it('sin sesiones en la semana devuelve [] y no consulta profiles', async () => {
    const calls = mockDb({ sessionPages: [ok([])], profiles: ok([]) });

    expect(await getWeeklyLeaderboard(50)).toEqual({ entries: [], hasMore: false });
    expect(calls.profiles).toHaveLength(0);
  });

  it('usa los totales agregados del RPC cuando existe (post-migración)', async () => {
    const calls = mockDb({ sessionPages: [], profiles: ok([profileRow('u1'), profileRow('u2')]) });
    mocks.rpc.mockResolvedValue({
      data: [
        { player_id: 'u1', played: 2, perfect: 1 }, // 2*10 + 25 = 45
        { player_id: 'u2', played: 1, perfect: 1 }, // 35
      ],
      error: null,
    });

    const { entries } = await getWeeklyLeaderboard(10);

    // Una fila de más sobre la página: hasMore exacto sin count aparte.
    expect(mocks.rpc).toHaveBeenCalledWith('get_weekly_session_totals', {
      p_limit: 11,
    });
    expect(mocks.from).not.toHaveBeenCalledWith('game_sessions');
    expect(entries[0]).toMatchObject({ rank: 1, points: 45, quizzesPlayed: 2 });
    expect(entries[1]).toMatchObject({ rank: 2, points: 35, quizzesPlayed: 1 });
    expect(calls.profiles.find((call) => call.method === 'in')?.args[1]).toHaveLength(2);
  });

  it('propaga el error si el RPC existe pero falla por otra causa', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(getWeeklyLeaderboard(50)).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propaga el error si falla la consulta de sesiones', async () => {
    mockDb({ sessionPages: [fail()], profiles: ok([]) });

    await expect(getWeeklyLeaderboard(50)).rejects.toThrow();
  });

  it('propaga el error si falla la consulta de perfiles', async () => {
    mockDb({
      sessionPages: [ok([{ player_id: 'u1', score: 1, max_score: 10 }])],
      profiles: fail(),
    });

    await expect(getWeeklyLeaderboard(50)).rejects.toThrow();
  });

  it('desempata por player_id cuando partidas y puntos empatan (paginación estable)', async () => {
    mockDb({
      sessionPages: [
        ok([
          { player_id: 'u3', score: 1, max_score: 10 },
          { player_id: 'u1', score: 1, max_score: 10 },
          { player_id: 'u2', score: 1, max_score: 10 },
        ]),
      ],
      profiles: ok([profileRow('u1'), profileRow('u2'), profileRow('u3')]),
    });

    const { entries } = await getWeeklyLeaderboard(10);

    expect(entries.map((entry) => entry.user.username)).toEqual(['user-u1', 'user-u2', 'user-u3']);
  });

  it('pagina: la página 2 arranca tras la 1 y hasMore refleja la fila extra', async () => {
    // 3 jugadores: página 1 con limit 2 trae 2 y hasMore; página 2 trae el resto.
    // Cada llamada barre su propia página del fixture (el mock consume una
    // página por consulta a game_sessions).
    const week = ok([
      { player_id: 'u1', score: 1, max_score: 10 },
      { player_id: 'u1', score: 1, max_score: 10 },
      { player_id: 'u2', score: 1, max_score: 10 },
      { player_id: 'u3', score: 1, max_score: 10 },
    ]);
    const calls = mockDb({
      sessionPages: [week, week],
      profiles: ok([profileRow('u1'), profileRow('u2'), profileRow('u3')]),
    });

    const first = await getWeeklyLeaderboard(2, 1);
    expect(first.entries.map((entry) => entry.user.username)).toEqual(['user-u1', 'user-u2']);
    expect(first.hasMore).toBe(true);

    const second = await getWeeklyLeaderboard(2, 2);
    expect(second.entries.map((entry) => entry.user.username)).toEqual(['user-u3']);
    expect(second.entries[0].rank).toBe(3);
    expect(second.hasMore).toBe(false);
    // La página 2 pide perfiles solo de su ventana.
    expect(calls.profiles.at(-1)?.args[1]).toHaveLength(1);
  });
});

describe('getWeeklyRank', () => {
  it('devuelve el puesto que calcula el RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: 61, error: null });

    expect(await getWeeklyRank('u-1')).toBe(61);
    expect(mocks.rpc).toHaveBeenCalledWith('get_weekly_rank', { p_user_id: 'u-1' });
  });

  it('null si la migración aún no está aplicada (RPC ausente)', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: MISSING_FUNCTION });

    expect(await getWeeklyRank('u-1')).toBeNull();
  });

  it('null si el RPC no devuelve número (sin partidas esta semana)', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    expect(await getWeeklyRank('u-1')).toBeNull();
  });

  it('propaga un error real del RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(getWeeklyRank('u-1')).rejects.toThrow();
  });
});
