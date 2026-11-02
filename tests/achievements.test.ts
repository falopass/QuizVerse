import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, upsertSpy, updateSpy, rpcSpy } = vi.hoisted(() => ({
  state: {
    profile: null as {
      points: number;
      quizzes_played: number;
      quizzes_created: number;
      current_streak?: number;
      longest_streak?: number;
    } | null,
    unlocked: new Set<string>(),
    catalog: {} as Record<string, { name: string; points_reward: number | null } | null>,
    playedCategories: 0,
    upsertError: null as { message: string } | null,
    rpcData: null as boolean | null,
    rpcError: null as { code?: string; message?: string } | null,
  },
  upsertSpy: vi.fn(),
  updateSpy: vi.fn(),
  rpcSpy: vi.fn(),
}));

const MISSING_FUNCTION = {
  code: 'PGRST202',
  message: 'Could not find the function in the schema cache',
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: unknown) => {
      rpcSpy(fn, args);
      if (fn === 'get_my_played_categories') {
        return { data: state.playedCategories, error: null };
      }
      return { data: state.rpcData, error: state.rpcError };
    },
    from: (table: string) => {
      if (table === 'user_achievements') {
        return {
          select: () => ({
            eq: () => ({
              eq: (_column: string, value: string) => ({
                maybeSingle: async () => ({
                  data: state.unlocked.has(value) ? { achievement_id: value } : null,
                  error: null,
                }),
              }),
            }),
          }),
          upsert: (payload: unknown) => {
            upsertSpy(payload);
            return Promise.resolve({ error: state.upsertError });
          },
        };
      }
      if (table === 'achievements') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: state.catalog[value] ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      // profiles
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.profile, error: null }),
          }),
        }),
        update: (payload: unknown) => {
          updateSpy(payload);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  }),
}));

import { checkAchievements } from '@/lib/quiz/achievements';

const CATALOG = {
  first_quiz: { name: 'First Quiz', points_reward: 10 },
  quiz_addict_10: { name: 'Quiz Addict', points_reward: 50 },
  quiz_master_50: { name: 'Quiz Master', points_reward: 150 },
  creator: { name: 'Creator', points_reward: 20 },
  perfect_score: { name: 'Perfect Score', points_reward: 25 },
  week_streak: { name: 'Streak Master', points_reward: 50 },
  explorer: { name: 'Explorer', points_reward: 75 },
};

describe('checkAchievements', () => {
  beforeEach(() => {
    state.profile = { points: 100, quizzes_played: 0, quizzes_created: 0 };
    state.unlocked = new Set();
    state.catalog = { ...CATALOG };
    state.playedCategories = 0;
    state.upsertError = null;
    state.rpcData = null;
    // Sin la migración el RPC no existe: ese es el camino por defecto y el
    // fallback a upsert+UPDATE es lo que ejercitan los tests de puntos.
    state.rpcError = MISSING_FUNCTION;
    upsertSpy.mockClear();
    updateSpy.mockClear();
    rpcSpy.mockClear();
  });

  it('returns [] for a null userId without touching the DB', async () => {
    const result = await checkAchievements(null);

    expect(result).toEqual([]);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('unlocks first_quiz when quizzes_played is 1', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };

    const result = await checkAchievements('user-1');

    expect(result).toEqual([{ id: 'first_quiz', name: 'First Quiz' }]);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith({
      user_id: 'user-1',
      achievement_id: 'first_quiz',
    });
  });

  it('unlocks first_quiz and quiz_addict_10 when quizzes_played is 12', async () => {
    state.profile = { points: 100, quizzes_played: 12, quizzes_created: 0 };

    const result = await checkAchievements('user-1');

    expect(result.map((a) => a.id)).toEqual(['first_quiz', 'quiz_addict_10']);
  });

  it('unlocks creator when quizzes_created is at least 1', async () => {
    state.profile = { points: 100, quizzes_played: 0, quizzes_created: 3 };

    const result = await checkAchievements('user-1');

    expect(result).toEqual([{ id: 'creator', name: 'Creator' }]);
  });

  it('unlocks perfect_score only when the context marks a perfect score', async () => {
    const without = await checkAchievements('user-1');
    expect(without.map((a) => a.id)).not.toContain('perfect_score');

    const withPerfect = await checkAchievements('user-1', { perfectScore: true });
    expect(withPerfect.map((a) => a.id)).toEqual(['perfect_score']);
  });

  it('does not re-insert an already unlocked achievement', async () => {
    state.profile = { points: 100, quizzes_played: 12, quizzes_created: 0 };
    state.unlocked = new Set(['first_quiz']);

    const result = await checkAchievements('user-1');

    expect(result.map((a) => a.id)).toEqual(['quiz_addict_10']);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith({
      user_id: 'user-1',
      achievement_id: 'quiz_addict_10',
    });
  });

  it('pays the reward declared in the achievements row, accumulating over prior points', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };

    await checkAchievements('user-1');

    expect(rpcSpy).toHaveBeenCalledWith('unlock_achievement', {
      p_achievement_id: 'first_quiz',
    });
    expect(updateSpy).toHaveBeenCalledWith({ points: 110 });
  });

  it('unlocks and pays via the atomic RPC without upsert nor read-modify-write', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };
    state.rpcError = null;
    state.rpcData = true;

    const result = await checkAchievements('user-1');

    expect(result).toEqual([{ id: 'first_quiz', name: 'First Quiz' }]);
    expect(rpcSpy).toHaveBeenCalledWith('unlock_achievement', {
      p_achievement_id: 'first_quiz',
    });
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('does not unlock when the RPC says the achievement was not new or not met', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };
    state.rpcError = null;
    state.rpcData = false;

    const result = await checkAchievements('user-1');

    expect(result).toEqual([]);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('does not unlock nor pay when the RPC fails for another reason', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };
    state.rpcError = { message: 'connection lost' };

    const result = await checkAchievements('user-1');

    expect(result).toEqual([]);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('accumulates rewards across multiple unlocks in one run', async () => {
    state.profile = { points: 0, quizzes_played: 12, quizzes_created: 0 };

    await checkAchievements('user-1');

    expect(updateSpy).toHaveBeenNthCalledWith(1, { points: 10 });
    expect(updateSpy).toHaveBeenNthCalledWith(2, { points: 60 });
  });

  it('returns [] when the profile lookup finds nothing', async () => {
    state.profile = null;

    const result = await checkAchievements('user-1');

    expect(result).toEqual([]);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('skips a condition whose catalog row is missing', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };
    state.catalog = {};

    const result = await checkAchievements('user-1');

    expect(result).toEqual([]);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('does not fail the game when the unlock upsert errors', async () => {
    state.profile = { points: 100, quizzes_played: 1, quizzes_created: 0 };
    state.upsertError = { message: 'db down' };

    const result = await checkAchievements('user-1');

    expect(result).toEqual([]);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('unlocks quiz_master_50 only from 50 games on', async () => {
    state.profile = { points: 0, quizzes_played: 49, quizzes_created: 0 };
    const before = await checkAchievements('user-1');
    expect(before.map((a) => a.id)).not.toContain('quiz_master_50');

    state.profile = { points: 0, quizzes_played: 50, quizzes_created: 0 };
    state.unlocked = new Set(['first_quiz', 'quiz_addict_10']);
    const after = await checkAchievements('user-1');
    expect(after.map((a) => a.id)).toEqual(['quiz_master_50']);
  });

  it('unlocks week_streak at 7 days, even if the current streak already broke', async () => {
    state.profile = {
      points: 0,
      quizzes_played: 8,
      quizzes_created: 0,
      current_streak: 6,
      longest_streak: 6,
    };
    const before = await checkAchievements('user-1');
    expect(before.map((a) => a.id)).not.toContain('week_streak');

    state.profile = {
      points: 0,
      quizzes_played: 8,
      quizzes_created: 0,
      current_streak: 2,
      longest_streak: 7,
    };
    state.unlocked = new Set(['first_quiz']);
    const after = await checkAchievements('user-1');
    expect(after.map((a) => a.id)).toContain('week_streak');
  });

  it('unlocks explorer with 5 distinct categories played', async () => {
    state.profile = { points: 0, quizzes_played: 5, quizzes_created: 0 };
    state.unlocked = new Set(['first_quiz']);

    state.playedCategories = 4;
    const before = await checkAchievements('user-1');
    expect(before.map((a) => a.id)).not.toContain('explorer');

    state.playedCategories = 5;
    const after = await checkAchievements('user-1');
    expect(after.map((a) => a.id)).toEqual(['explorer']);
    expect(rpcSpy).toHaveBeenCalledWith('get_my_played_categories', undefined);
  });

  it('sin las columnas de racha (migración 018 sin aplicar) no inventa logros nuevos', async () => {
    state.profile = { points: 0, quizzes_played: 5, quizzes_created: 0 };
    state.unlocked = new Set(['first_quiz']);

    const result = await checkAchievements('user-1');

    expect(result).toEqual([]);
  });
});
