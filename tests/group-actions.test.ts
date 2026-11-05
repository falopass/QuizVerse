import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateCheck: vi.fn(),
  fetchExistingGroup: vi.fn(),
  fetchGroupByToken: vi.fn(),
  fetchGroupEntries: vi.fn(),
  fetchGroupEntry: vi.fn(),
  fetchSessionForGroup: vi.fn(),
  insertGroup: vi.fn(),
  insertGroupEntry: vi.fn(),
  getUser: vi.fn(),
  attemptsAvailable: vi.fn(),
  verifyQuizAttempt: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/utils/client-ip', () => ({ clientIpFromHeaders: () => '1.2.3.4' }));
vi.mock('@/lib/utils/rate-limit', () => ({
  createRateLimiter: () => ({ check: mocks.rateCheck }),
}));
vi.mock('@/lib/quiz/attempt', () => ({
  attemptsAvailable: mocks.attemptsAvailable,
  verifyQuizAttempt: mocks.verifyQuizAttempt,
  warnAttemptsInactive: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }));
vi.mock('@/lib/data/group', () => ({
  fetchExistingGroup: mocks.fetchExistingGroup,
  fetchGroupByToken: mocks.fetchGroupByToken,
  fetchGroupEntries: mocks.fetchGroupEntries,
  fetchGroupEntry: mocks.fetchGroupEntry,
  fetchSessionForGroup: mocks.fetchSessionForGroup,
  insertGroup: mocks.insertGroup,
  insertGroupEntry: mocks.insertGroupEntry,
}));

import { createQuizGroup, getQuizGroupLeaderboard, joinQuizGroup } from '@/actions/group.actions';

const SHARE_TOKEN = '0123456789abcdef';
const GROUP_TOKEN = '0123456789abcdef0123';

const session = {
  id: 'sess-1',
  quiz_id: 'quiz-1',
  player_id: 'user-1',
  attempt_id: 'att-1',
  score: 7,
  max_score: 8,
  time_taken_seconds: 42,
};

const validAttempt = {
  ok: true as const,
  attempt: { quizId: 'quiz-1', attemptId: 'att-1', issuedAt: 1, expiresAt: 9999999999 },
};

const group = {
  id: 'group-1',
  quizId: 'quiz-1',
  token: GROUP_TOKEN,
  creatorNickname: 'Diego',
  playerCount: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
};

const ok = <T>(value: T | null) => ({ state: 'ok' as const, value });
const missing = <T>() => ({ state: 'missing' as const, value: null as T | null });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateCheck.mockResolvedValue({ allowed: true });
  // Titularidad por defecto: usuario autenticado dueño de la partida.
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mocks.attemptsAvailable.mockReturnValue(true);
  mocks.verifyQuizAttempt.mockResolvedValue(validAttempt);
  mocks.fetchSessionForGroup.mockResolvedValue(ok(session));
  mocks.fetchExistingGroup.mockResolvedValue(ok(null));
  mocks.insertGroup.mockResolvedValue(ok(group));
  mocks.fetchGroupByToken.mockResolvedValue(ok(group));
  mocks.fetchGroupEntries.mockResolvedValue(ok([]));
  mocks.fetchGroupEntry.mockResolvedValue(ok(null));
  mocks.insertGroupEntry.mockResolvedValue('ok');
});

describe('createQuizGroup', () => {
  it('rechaza un share token malformado', async () => {
    const result = await createQuizGroup({ shareToken: 'nope', nickname: 'Diego' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
    expect(mocks.insertGroup).not.toHaveBeenCalled();
  });

  it('modera el apodo del creador antes de tocar la base', async () => {
    const result = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: 'puta' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('nickname_blocked');
    expect(mocks.fetchSessionForGroup).not.toHaveBeenCalled();
  });

  it('responde rate_limited sin llegar a la capa de datos', async () => {
    mocks.rateCheck.mockResolvedValue({ allowed: false });
    const result = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: 'Diego' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('rate_limited');
    expect(mocks.fetchSessionForGroup).not.toHaveBeenCalled();
  });

  it('reutiliza el grupo ya creado por el mismo creador', async () => {
    mocks.fetchExistingGroup.mockResolvedValue(ok(group));
    const result = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: 'Diego' });
    expect(result).toEqual({ success: true, groupToken: GROUP_TOKEN, group, reused: true });
    expect(mocks.insertGroup).not.toHaveBeenCalled();
  });

  it('crea el grupo con quiz y creador de la sesión (no del cliente)', async () => {
    const result = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: ' Diego ' });
    expect(result).toEqual({ success: true, groupToken: GROUP_TOKEN, group, reused: false });
    expect(mocks.insertGroup).toHaveBeenCalledWith(expect.anything(), {
      quiz_id: 'quiz-1',
      creator_session_id: 'sess-1',
      creator_user_id: 'user-1',
      creator_nickname: 'Diego',
    });
  });

  it('una carrera de creación devuelve el grupo que ganó, no un error', async () => {
    mocks.insertGroup.mockResolvedValue({ state: 'conflict', value: null });
    mocks.fetchExistingGroup
      .mockResolvedValueOnce(ok(null)) // consulta previa: nadie lo había creado
      .mockResolvedValueOnce(ok(group)); // tras el conflicto: el ganador
    const result = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: 'Diego' });
    expect(result).toEqual({ success: true, groupToken: GROUP_TOKEN, group, reused: true });
  });

  it('degrada a unavailable cuando falta la migración', async () => {
    mocks.fetchExistingGroup.mockResolvedValue(missing());
    const result = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: 'Diego' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('unavailable');
  });
});

describe('joinQuizGroup', () => {
  const join = (nickname = 'Camila') =>
    joinQuizGroup({ groupToken: GROUP_TOKEN, sessionToken: SHARE_TOKEN, nickname });

  it('toma puntaje, máximo y tiempo de la sesión del servidor', async () => {
    const result = await join();
    expect(result.success).toBe(true);
    expect(mocks.insertGroupEntry).toHaveBeenCalledWith(expect.anything(), {
      group_id: 'group-1',
      nickname: 'Camila',
      score: 7,
      max_score: 8,
      time_taken_seconds: 42,
      game_session_id: 'sess-1',
    });
    if (result.success) {
      expect(result.entry.score).toBe(7);
      expect(result.entry.maxScore).toBe(8);
      expect(result.alreadyJoined).toBe(false);
    }
  });

  it('una partida entra una sola vez: devuelve la entrada existente', async () => {
    mocks.fetchGroupEntry.mockResolvedValue(
      ok({
        nickname: 'Camila',
        score: 7,
        maxScore: 8,
        timeTakenSeconds: 42,
        gameSessionId: 'sess-1',
        createdAt: '2025-01-01T00:00:00.000Z',
      })
    );
    const result = await join('OtroApodo');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.alreadyJoined).toBe(true);
      expect(result.entry.nickname).toBe('Camila'); // no se renombra
    }
    expect(mocks.insertGroupEntry).not.toHaveBeenCalled();
  });

  it('un conflicto de único se resuelve como ya entró', async () => {
    mocks.insertGroupEntry.mockResolvedValue('conflict');
    mocks.fetchGroupEntry.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(
      ok({
        nickname: 'Camila',
        score: 7,
        maxScore: 8,
        timeTakenSeconds: 42,
        gameSessionId: 'sess-1',
        createdAt: '2025-01-01T00:00:00.000Z',
      })
    );
    const result = await join();
    expect(result.success).toBe(true);
    if (result.success) expect(result.alreadyJoined).toBe(true);
  });

  it('rechaza una sesión de otro quiz', async () => {
    mocks.fetchSessionForGroup.mockResolvedValue(ok({ ...session, quiz_id: 'otro' }));
    const result = await join();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
    expect(mocks.insertGroupEntry).not.toHaveBeenCalled();
  });

  it('rechaza grupo inexistente', async () => {
    mocks.fetchGroupByToken.mockResolvedValue(ok(null));
    const result = await join();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('not_found');
  });

  it('degrada a unavailable cuando falta la migración', async () => {
    mocks.fetchGroupByToken.mockResolvedValue(missing());
    const result = await join();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('unavailable');
  });
});

describe('titularidad de la partida', () => {
  const anonymous = () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.fetchSessionForGroup.mockResolvedValue(ok({ ...session, player_id: null }));
  };

  it('token de resultado ajeno sin attempt → unauthorized (crear y unir)', async () => {
    anonymous();
    mocks.verifyQuizAttempt.mockResolvedValue({ ok: false, reason: 'missing' });

    const created = await createQuizGroup({ shareToken: SHARE_TOKEN, nickname: 'Diego' });
    expect(created.success).toBe(false);
    if (!created.success) expect(created.code).toBe('unauthorized');
    expect(mocks.insertGroup).not.toHaveBeenCalled();

    const joined = await joinQuizGroup({
      groupToken: GROUP_TOKEN,
      sessionToken: SHARE_TOKEN,
      nickname: 'Camila',
    });
    expect(joined.success).toBe(false);
    if (!joined.success) expect(joined.code).toBe('unauthorized');
    expect(mocks.insertGroupEntry).not.toHaveBeenCalled();
  });

  it('attempt de otra partida → unauthorized', async () => {
    anonymous();
    mocks.verifyQuizAttempt.mockResolvedValue({
      ok: true,
      attempt: { quizId: 'quiz-1', attemptId: 'otro-attempt', issuedAt: 1, expiresAt: 9999999999 },
    });
    const result = await joinQuizGroup({
      groupToken: GROUP_TOKEN,
      sessionToken: SHARE_TOKEN,
      nickname: 'Camila',
      attempt: 'v1.payload.firma',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('unauthorized');
    expect(mocks.insertGroupEntry).not.toHaveBeenCalled();
  });

  it('attempt correcto de una sesión anónima → ok en crear y unir', async () => {
    anonymous();
    const created = await createQuizGroup({
      shareToken: SHARE_TOKEN,
      nickname: 'Diego',
      attempt: 'v1.payload.firma',
    });
    expect(created.success).toBe(true);
    const joined = await joinQuizGroup({
      groupToken: GROUP_TOKEN,
      sessionToken: SHARE_TOKEN,
      nickname: 'Camila',
      attempt: 'v1.payload.firma',
    });
    expect(joined.success).toBe(true);
    expect(mocks.verifyQuizAttempt).toHaveBeenCalledWith('v1.payload.firma', 'quiz-1');
  });

  it('usuario dueño con sesión → ok aunque el attempt falte', async () => {
    mocks.verifyQuizAttempt.mockResolvedValue({ ok: false, reason: 'missing' });
    const result = await joinQuizGroup({
      groupToken: GROUP_TOKEN,
      sessionToken: SHARE_TOKEN,
      nickname: 'Camila',
    });
    expect(result.success).toBe(true);
  });

  it('modo degradado: solo partidas sin attempt_id', async () => {
    anonymous();
    mocks.attemptsAvailable.mockReturnValue(false);

    mocks.fetchSessionForGroup.mockResolvedValue(
      ok({ ...session, player_id: null, attempt_id: 'att-1' })
    );
    const bound = await joinQuizGroup({
      groupToken: GROUP_TOKEN,
      sessionToken: SHARE_TOKEN,
      nickname: 'Camila',
    });
    expect(bound.success).toBe(false);
    if (!bound.success) expect(bound.code).toBe('unauthorized');

    mocks.fetchSessionForGroup.mockResolvedValue(
      ok({ ...session, player_id: null, attempt_id: null })
    );
    const legacy = await joinQuizGroup({
      groupToken: GROUP_TOKEN,
      sessionToken: SHARE_TOKEN,
      nickname: 'Camila',
    });
    expect(legacy.success).toBe(true);
  });
});

describe('getQuizGroupLeaderboard', () => {
  it('devuelve grupo y entradas ordenadas', async () => {
    const entries = [
      {
        nickname: 'Camila',
        score: 8,
        maxScore: 8,
        timeTakenSeconds: 30,
        gameSessionId: 's2',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    mocks.fetchGroupEntries.mockResolvedValue(ok(entries));
    const result = await getQuizGroupLeaderboard(GROUP_TOKEN);
    expect(result).toEqual({ success: true, group, entries });
  });

  it('token malformado → invalid_input sin consultas', async () => {
    const result = await getQuizGroupLeaderboard('xxxx');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('invalid_input');
    expect(mocks.fetchGroupByToken).not.toHaveBeenCalled();
  });

  it('migración pendiente → unavailable', async () => {
    mocks.fetchGroupByToken.mockResolvedValue(missing());
    const result = await getQuizGroupLeaderboard(GROUP_TOKEN);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('unavailable');
  });

  it('grupo inexistente → not_found', async () => {
    mocks.fetchGroupByToken.mockResolvedValue(ok(null));
    const result = await getQuizGroupLeaderboard(GROUP_TOKEN);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('not_found');
  });
});
