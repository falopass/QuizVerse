import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
  from: vi.fn(),
  state: {
    profile: null as {
      points: number;
      quizzes_played: number;
      quizzes_created: number;
      current_streak: number;
      longest_streak: number;
    } | null,
    catalog: [] as Array<Record<string, unknown>>,
    owned: [] as Array<{ achievement_id: string }>,
    playedCategories: 0,
    unlockResult: true,
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));

import { reconcileAchievements } from '@/actions/achievements.actions';

const row = (id: string, condition_type: string, condition_value: number) => ({
  id,
  name: id,
  description: id,
  icon: 'target',
  points_reward: 10,
  condition_type,
  condition_value,
});

/** PostgREST devuelve un builder «thenable»: `await` sin `.single()`. */
function thenable(data: unknown) {
  return { then: (resolve: (value: unknown) => void) => resolve({ data, error: null }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.profile = {
    points: 0,
    quizzes_played: 60,
    quizzes_created: 0,
    current_streak: 2,
    longest_streak: 2,
  };
  mocks.state.catalog = [
    row('first_quiz', 'plays', 1),
    row('quiz_addict_10', 'plays', 10),
    row('quiz_master_50', 'plays', 50),
    row('creator', 'creates', 1),
    row('week_streak', 'streak', 7),
    row('explorer', 'categories', 5),
    row('going_viral', 'shares', 100),
  ];
  mocks.state.owned = [{ achievement_id: 'first_quiz' }];
  mocks.state.playedCategories = 3;
  mocks.state.unlockResult = true;

  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mocks.rpc.mockImplementation(async (fn: string) =>
    fn === 'get_my_played_categories'
      ? { data: mocks.state.playedCategories, error: null }
      : { data: mocks.state.unlockResult, error: null }
  );
  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: mocks.state.profile, error: null }) }),
        }),
      };
    }
    if (table === 'achievements') {
      return { select: () => thenable(mocks.state.catalog) };
    }
    if (table === 'user_achievements') {
      return { select: () => ({ eq: () => thenable(mocks.state.owned) }) };
    }
    throw new Error(`tabla inesperada: ${table}`);
  });
});

describe('reconcileAchievements', () => {
  it('sin sesión no consulta ni concede nada', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(reconcileAchievements('es')).resolves.toEqual({ unlocked: [] });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('concede solo los pendientes cuyo contador ya cumple la meta', async () => {
    const result = await reconcileAchievements('es');

    // first_quiz ya lo tiene; creator (0/1) y week_streak (2/7) no cumplen;
    // explorer sí (3/5 no) → quedan quiz_addict_10 y quiz_master_50.
    expect(result.unlocked).toEqual(['quiz_addict_10', 'quiz_master_50']);
    expect(mocks.rpc).toHaveBeenCalledWith('unlock_achievement', {
      p_achievement_id: 'quiz_addict_10',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('unlock_achievement', {
      p_achievement_id: 'quiz_master_50',
    });
    expect(mocks.revalidate).toHaveBeenCalledWith('/es/achievements');
  });

  it('con 5 categorías jugadas también concede explorer', async () => {
    mocks.state.playedCategories = 5;

    const result = await reconcileAchievements('es');

    expect(result.unlocked).toContain('explorer');
  });

  it('no cuenta ni revalida lo que el RPC rechaza', async () => {
    mocks.state.unlockResult = false;

    const result = await reconcileAchievements('es');

    expect(result.unlocked).toEqual([]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it('nunca intenta los logros ocultos ni los ya ganados', async () => {
    await reconcileAchievements('es');

    const ids = mocks.rpc.mock.calls
      .filter(([fn]) => fn === 'unlock_achievement')
      .map(([, args]) => (args as { p_achievement_id: string }).p_achievement_id);

    expect(ids).not.toContain('going_viral');
    expect(ids).not.toContain('first_quiz');
  });

  it('si no puede leer los contadores, no concede nada', async () => {
    mocks.state.profile = null;

    await expect(reconcileAchievements('es')).resolves.toEqual({ unlocked: [] });
    expect(mocks.rpc).not.toHaveBeenCalledWith('unlock_achievement', expect.anything());
  });
});
