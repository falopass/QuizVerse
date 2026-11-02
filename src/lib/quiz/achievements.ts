/**
 * Achievement unlocking.
 *
 * Runs after a game is stored and is best-effort by design: a failure here must
 * never fail the game the player just finished. Each unlock pays the reward that
 * the `achievements` row declares — never a hardcoded number.
 *
 * Only conditions the schema can actually evaluate are checked. Shares,
 * streaks and "distinct categories played" need counters that `profiles` does
 * not have yet; they are intentionally absent instead of guessed.
 */

import { createClient } from '@/lib/supabase/server';
import { isMissingRpcFunction } from '@/lib/supabase/rpc';

type AchievementId = 'first_quiz' | 'quiz_addict_10' | 'creator' | 'perfect_score';
type Client = Awaited<ReturnType<typeof createClient>>;

interface ProfileStats {
  points: number;
  quizzes_played: number;
  quizzes_created: number;
}

export interface UnlockedAchievement {
  id: string;
  name: string;
}

export interface AchievementContext {
  /** Set when the game that just finished was flawless. */
  perfectScore?: boolean;
}

interface Condition {
  id: AchievementId;
  satisfied: (stats: ProfileStats, context: AchievementContext) => boolean;
}

const CONDITIONS: Condition[] = [
  { id: 'first_quiz', satisfied: (stats) => stats.quizzes_played >= 1 },
  { id: 'quiz_addict_10', satisfied: (stats) => stats.quizzes_played >= 10 },
  { id: 'creator', satisfied: (stats) => stats.quizzes_created >= 1 },
  { id: 'perfect_score', satisfied: (_stats, context) => context.perfectScore === true },
];

/**
 * Desbloquea el logro y paga su premio en un solo paso.
 *
 * Con la migración 013 lo hace el RPC `unlock_achievement`: verifica la
 * condición en SQL y paga el `points_reward` del catálogo — el llamador no
 * pasa ni usuario ni delta — y devuelve true solo si el logro era nuevo.
 * Mientras el RPC no exista cae al camino de siempre (upsert del logro +
 * UPDATE read-modify-write). Un error que no sea "función inexistente" no
 * reintenta: el logro queda para la próxima partida.
 */
async function unlockAchievement(
  supabase: Client,
  userId: string,
  achievementId: AchievementId,
  reward: number,
  stats: ProfileStats
): Promise<boolean> {
  const { data, error } = await supabase.rpc('unlock_achievement', {
    p_achievement_id: achievementId,
  });
  if (!error) return data === true;
  if (!isMissingRpcFunction(error)) return false;

  const { error: unlockError } = await supabase
    .from('user_achievements')
    .upsert(
      { user_id: userId, achievement_id: achievementId },
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true }
    );
  if (unlockError) return false;

  if (reward > 0) {
    const next = stats.points + reward;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ points: next })
      .eq('id', userId);
    if (!updateError) stats.points = next;
  }
  return true;
}

/**
 * Unlocks every achievement the player now qualifies for.
 *
 * Already-unlocked achievements are skipped, so calling this after every game is
 * idempotent.
 */
export async function checkAchievements(
  userId: string | null,
  context: AchievementContext = {}
): Promise<UnlockedAchievement[]> {
  if (!userId) return [];

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('points, quizzes_played, quizzes_created')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return [];

  const stats: ProfileStats = {
    points: profile.points,
    quizzes_played: profile.quizzes_played,
    quizzes_created: profile.quizzes_created,
  };

  const unlocked: UnlockedAchievement[] = [];

  for (const condition of CONDITIONS) {
    if (!condition.satisfied(stats, context)) continue;

    const { data: existing } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .eq('achievement_id', condition.id)
      .maybeSingle();

    if (existing) continue;

    const { data: achievement } = await supabase
      .from('achievements')
      .select('name, points_reward')
      .eq('id', condition.id)
      .maybeSingle();

    if (!achievement) continue;

    const unlockedNow = await unlockAchievement(
      supabase,
      userId,
      condition.id,
      achievement.points_reward ?? 0,
      stats
    );
    if (!unlockedNow) continue;

    unlocked.push({ id: condition.id, name: achievement.name });
  }

  return unlocked;
}
