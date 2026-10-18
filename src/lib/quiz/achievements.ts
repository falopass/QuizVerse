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

type AchievementId = 'first_quiz' | 'quiz_addict_10' | 'creator' | 'perfect_score';

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

    const { error: unlockError } = await supabase
      .from('user_achievements')
      .upsert(
        { user_id: userId, achievement_id: condition.id },
        { onConflict: 'user_id,achievement_id', ignoreDuplicates: true }
      );

    if (unlockError) continue;

    const reward = achievement.points_reward ?? 0;
    if (reward > 0) {
      const updatedPoints = stats.points + reward;
      const { error: pointsError } = await supabase
        .from('profiles')
        .update({ points: updatedPoints })
        .eq('id', userId);
      if (!pointsError) stats.points = updatedPoints;
    }

    unlocked.push({ id: condition.id, name: achievement.name });
  }

  return unlocked;
}
