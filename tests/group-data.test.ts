/**
 * `src/lib/data/group`: la capa del ranking por token. Con mocks del cliente
 * Supabase y del service role se cubre el mapeo de filas, la degradación por
 * migración ausente (PGRST202/205) y la idempotencia (conflicto 23505).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  serviceFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mocks.serviceFrom }),
}));

import {
  fetchExistingGroup,
  fetchGroupByToken,
  fetchGroupEntries,
  fetchGroupEntry,
  fetchGroupForSession,
  fetchSessionForGroup,
  insertGroup,
  insertGroupEntry,
  isBetterGroupAttempt,
  pickProfileNickname,
  reconcileParticipantGroupEntry,
  sortGroupEntriesDeterministically,
} from '@/lib/data/group';

const TOKEN = '0123456789abcdef0123';

const groupRow = {
  id: 'group-1',
  quiz_id: 'quiz-1',
  token: TOKEN,
  creator_nickname: 'Diego',
  entries_count: 2,
  created_at: '2025-01-01T00:00:00.000Z',
};

const entryRow = {
  nickname: 'Camila',
  score: 8,
  max_score: 8,
  time_taken_seconds: 30,
  game_session_id: 'sess-2',
  created_at: '2025-01-01T00:00:00.000Z',
  position: 1,
};

/** Builder thenable: cualquier método encadena y los terminales resuelven. */
function query(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const filters: [string, unknown, unknown][] = [];
  const builder: Record<string, unknown> = { filters };
  for (const m of ['select', 'eq', 'is', 'limit', 'insert', 'order', 'update', 'upsert']) {
    builder[m] = (...args: unknown[]) => {
      if (m === 'eq' || m === 'is') filters.push([m, args[0], args[1]]);
      return builder;
    };
  }
  builder.maybeSingle = async () => ({ data: result.data ?? null, error: result.error ?? null });
  builder.single = async () => ({ data: result.data ?? null, error: result.error ?? null });
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    });
  return builder;
}

const client = () => ({ rpc: mocks.rpc }) as never;
const service = () => ({ from: mocks.serviceFrom }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pickProfileNickname', () => {
  it.each([
    [{ username: 'dieg0', display_name: 'Diego F.' }, 'Diego F.'],
    [{ username: 'dieg0', display_name: null }, 'dieg0'],
    [{ username: 'dieg0', display_name: '  ' }, 'dieg0'],
    [{ username: null, display_name: null }, undefined],
    [null, undefined],
  ])('perfil %j → %s', (profile, expected) => {
    expect(pickProfileNickname(profile)).toBe(expected);
  });
});

describe('fetchGroupByToken', () => {
  it('mapea el grupo público con conteo del RPC', async () => {
    mocks.rpc.mockReturnValue({ maybeSingle: async () => ({ data: groupRow, error: null }) });
    const result = await fetchGroupByToken(client(), TOKEN);
    expect(result.state).toBe('ok');
    expect(result.value).toEqual({
      id: 'group-1',
      quizId: 'quiz-1',
      token: TOKEN,
      creatorNickname: 'Diego',
      playerCount: 2,
      createdAt: groupRow.created_at,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_quiz_group_by_token', { p_token: TOKEN });
  });

  it('token sin grupo → ok con null', async () => {
    mocks.rpc.mockReturnValue({ maybeSingle: async () => ({ data: null, error: null }) });
    const result = await fetchGroupByToken(client(), TOKEN);
    expect(result).toEqual({ state: 'ok', value: null });
  });

  it.each([
    { code: 'PGRST202', message: 'Could not find the function' },
    { code: 'PGRST205', message: 'Could not find the table' },
    { code: '42P01', message: 'relation does not exist' },
  ])('función/tabla ausente ($code) → missing', async (error) => {
    mocks.rpc.mockReturnValue({ maybeSingle: async () => ({ data: null, error }) });
    const result = await fetchGroupByToken(client(), TOKEN);
    expect(result.state).toBe('missing');
  });

  it('error real → error', async () => {
    mocks.rpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: { code: 'XX000', message: 'boom' } }),
    });
    const result = await fetchGroupByToken(client(), TOKEN);
    expect(result.state).toBe('error');
  });
});

describe('fetchGroupEntries', () => {
  it('devuelve entradas ordenadas con posición real y pasa p_session', async () => {
    mocks.rpc.mockImplementation(() => ({
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: [entryRow, { ...entryRow, nickname: 'Pato', score: 5, position: 2 }],
          error: null,
        }),
    }));
    const result = await fetchGroupEntries(client(), TOKEN, 'sess-9');
    expect(mocks.rpc).toHaveBeenCalledWith('get_quiz_group_entries', {
      p_token: TOKEN,
      p_session: 'sess-9',
    });
    expect(result.state).toBe('ok');
    expect(result.value?.[0].nickname).toBe('Camila');
    expect(result.value?.[0].position).toBe(1);
  });

  it('sin sesión propia pasa p_session null', async () => {
    mocks.rpc.mockImplementation(() => ({
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    }));
    await fetchGroupEntries(client(), TOKEN);
    expect(mocks.rpc).toHaveBeenCalledWith('get_quiz_group_entries', {
      p_token: TOKEN,
      p_session: null,
    });
  });

  it('migración ausente → missing', async () => {
    mocks.rpc.mockImplementation(() => ({
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { code: 'PGRST202', message: 'missing' } }),
    }));
    const result = await fetchGroupEntries(client(), TOKEN);
    expect(result.state).toBe('missing');
  });
});

describe('fetchGroupForSession', () => {
  it('resuelve el grupo de una partida ya inscrita con su conteo', async () => {
    // Primera llamada: entry → group_id; segunda: group; tercera: count.
    const calls: Record<string, unknown>[] = [
      { data: { group_id: 'group-1' } },
      { data: groupRow },
      { data: null, count: 3 },
    ];
    let i = 0;
    mocks.serviceFrom.mockImplementation(() => query(calls[Math.min(i++, calls.length - 1)]));

    const result = await fetchGroupForSession('sess-1');
    expect(result?.token).toBe(TOKEN);
    expect(result?.playerCount).toBe(3);
  });

  it('sin entrada → null', async () => {
    mocks.serviceFrom.mockImplementation(() => query({ data: null }));
    expect(await fetchGroupForSession('sess-1')).toBeNull();
  });
});

describe('fetchSessionForGroup', () => {
  it('devuelve la sesión por share_token', async () => {
    mocks.serviceFrom.mockImplementation(() =>
      query({
        data: {
          id: 'sess-1',
          quiz_id: 'quiz-1',
          player_id: null,
          attempt_id: 'att-1',
          score: 7,
          max_score: 8,
          time_taken_seconds: 42,
        },
      })
    );
    const result = await fetchSessionForGroup(service(), 'aaaa1111bbbb2222');
    expect(result.state).toBe('ok');
    expect(result.value?.id).toBe('sess-1');
  });
});

describe('fetchExistingGroup', () => {
  it('con usuario filtra por quiz y creator_user_id', async () => {
    const first = query({ data: groupRow });
    let calls = 0;
    mocks.serviceFrom.mockImplementation(() => (calls++ === 0 ? first : query({ count: 4 })));
    const result = await fetchExistingGroup(service(), 'quiz-1', 'sess-1', 'user-1');
    expect(result.state).toBe('ok');
    expect(result.value?.token).toBe(TOKEN);
    expect(result.value?.playerCount).toBe(4);
    expect(first.filters).toEqual([
      ['eq', 'quiz_id', 'quiz-1'],
      ['eq', 'creator_user_id', 'user-1'],
    ]);
    expect(mocks.serviceFrom).toHaveBeenNthCalledWith(1, 'quiz_groups');
  });

  it('sin usuario filtra por sesión con creator_user_id null', async () => {
    const first = query({ data: groupRow });
    let calls = 0;
    mocks.serviceFrom.mockImplementation(() => (calls++ === 0 ? first : query({ count: 1 })));
    await fetchExistingGroup(service(), 'quiz-1', 'sess-1', null);
    expect(first.filters).toEqual([
      ['eq', 'quiz_id', 'quiz-1'],
      ['is', 'creator_user_id', null],
      ['eq', 'creator_session_id', 'sess-1'],
    ]);
  });

  it('sin grupo → ok con null', async () => {
    mocks.serviceFrom.mockImplementation(() => query({ data: null }));
    const result = await fetchExistingGroup(service(), 'quiz-1', 'sess-1', null);
    expect(result.value).toBeNull();
  });
});

describe('insertGroup', () => {
  const row = {
    quiz_id: 'quiz-1',
    creator_session_id: 'sess-1',
    creator_user_id: null,
    creator_nickname: 'Diego',
  };

  it('inserta y devuelve el grupo con playerCount 0', async () => {
    mocks.serviceFrom.mockImplementation(() => query({ data: groupRow }));
    const result = await insertGroup(service(), row);
    expect(result.state).toBe('ok');
    expect(result.value?.token).toBe(TOKEN);
    expect(result.value?.playerCount).toBe(0);
  });

  it('conflicto de único → conflict', async () => {
    mocks.serviceFrom.mockImplementation(() =>
      query({ error: { code: '23505', message: 'duplicate key' } })
    );
    const result = await insertGroup(service(), row);
    expect(result.state).toBe('conflict');
  });

  it('tabla ausente → missing', async () => {
    mocks.serviceFrom.mockImplementation(() =>
      query({ error: { code: '42P01', message: 'relation does not exist' } })
    );
    const result = await insertGroup(service(), row);
    expect(result.state).toBe('missing');
  });
});

describe('fetchGroupEntry', () => {
  it('devuelve la entrada existente', async () => {
    mocks.serviceFrom.mockImplementation(() => query({ data: entryRow }));
    const result = await fetchGroupEntry(service(), 'group-1', 'sess-2');
    expect(result.state).toBe('ok');
    expect(result.value?.nickname).toBe('Camila');
    expect(result.value?.gameSessionId).toBe('sess-2');
  });
});

describe('insertGroupEntry', () => {
  const row = {
    group_id: 'group-1',
    nickname: 'Camila',
    score: 8,
    max_score: 8,
    time_taken_seconds: 30,
    game_session_id: 'sess-2',
  };

  it('inserta → ok', async () => {
    mocks.serviceFrom.mockImplementation(() => query({ data: null }));
    expect(await insertGroupEntry(service(), row)).toBe('ok');
  });

  it('duplicado → conflict', async () => {
    mocks.serviceFrom.mockImplementation(() =>
      query({ error: { code: '23505', message: 'duplicate' } })
    );
    expect(await insertGroupEntry(service(), row)).toBe('conflict');
  });

  it('tabla ausente → missing', async () => {
    mocks.serviceFrom.mockImplementation(() =>
      query({ error: { code: 'PGRST205', message: 'missing table' } })
    );
    expect(await insertGroupEntry(service(), row)).toBe('missing');
  });
});

describe('mejor intento por participante y desempate estable', () => {
  it('desempata determinísticamente por puntaje, tiempo, fecha y gameSessionId', () => {
    const sorted = sortGroupEntriesDeterministically([
      {
        nickname: 'B',
        score: 7,
        maxScore: 8,
        timeTakenSeconds: 30,
        gameSessionId: 'sess-b',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        nickname: 'A',
        score: 7,
        maxScore: 8,
        timeTakenSeconds: 30,
        gameSessionId: 'sess-a',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    expect(sorted.map((item) => item.gameSessionId)).toEqual(['sess-a', 'sess-b']);
    expect(
      isBetterGroupAttempt(
        { score: 7, time_taken_seconds: 25 },
        { score: 7, time_taken_seconds: 30 }
      )
    ).toBe(true);
    expect(
      isBetterGroupAttempt(
        { score: 7, time_taken_seconds: 35 },
        { score: 7, time_taken_seconds: 30 }
      )
    ).toBe(false);
  });

  it('reconcileParticipantGroupEntry conserva la marca previa si la nueva no la supera y reemplaza si es mejor', async () => {
    const prevEntry = {
      id: 'entry-1',
      nickname: 'Diego',
      score: 7,
      max_score: 8,
      time_taken_seconds: 30,
      game_session_id: 'sess-prev',
      created_at: '2025-01-01T00:00:00.000Z',
    };
    const calls = [{ data: [prevEntry] }, { data: [{ id: 'sess-prev', player_id: 'user-1' }] }];
    let idx = 0;
    mocks.serviceFrom.mockImplementation(() => query(calls[idx++]));

    const kept = await reconcileParticipantGroupEntry(
      service(),
      'group-1',
      {
        id: 'sess-worse',
        quiz_id: 'quiz-1',
        player_id: 'user-1',
        attempt_id: 'att-2',
        score: 6,
        max_score: 8,
        time_taken_seconds: 20,
      },
      'Diego'
    );
    expect(kept.action).toBe('keep_existing');
    expect(kept.entry?.gameSessionId).toBe('sess-prev');

    const replaceCalls = [
      { data: [prevEntry] },
      { data: [{ id: 'sess-prev', player_id: 'user-1' }] },
      { data: null },
    ];
    let rIdx = 0;
    mocks.serviceFrom.mockImplementation(() => query(replaceCalls[rIdx++]));

    const replaced = await reconcileParticipantGroupEntry(
      service(),
      'group-1',
      {
        id: 'sess-better',
        quiz_id: 'quiz-1',
        player_id: 'user-1',
        attempt_id: 'att-3',
        score: 8,
        max_score: 8,
        time_taken_seconds: 28,
      },
      'Diego'
    );
    expect(replaced.action).toBe('replaced');
    expect(replaced.entry?.score).toBe(8);
    expect(replaced.entry?.gameSessionId).toBe('sess-better');
  });
});
