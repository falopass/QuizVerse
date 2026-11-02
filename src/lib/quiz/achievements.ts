/**
 * Achievement unlocking.
 *
 * Runs after a game is stored and is best-effort by design: a failure here must
 * never fail the game the player just finished. Each unlock pays the reward that
 * the `achievements` row declares — never a hardcoded number.
 *
 * Only conditions the schema can actually evaluate are checked. With the
 * migration 018 that includes the daily streak and the distinct categories
 * played; the three achievements that need metrics the product does not record
 * reliably (`going_viral`, `internet_famous`, `social_butterfly`) are left
 * without a condition and hidden in the UI instead of guessed.
 */

import { createClient } from '@/lib/supabase/server';
import { isMissingRpcFunction } from '@/lib/supabase/rpc';

type AchievementId =
  | 'first_quiz'
  | 'quiz_addict_10'
  | 'quiz_master_50'
  | 'creator'
  | 'perfect_score'
  | 'week_streak'
  | 'explorer';
type Client = Awaited<ReturnType<typeof createClient>>;

export interface ProfileStats {
  points: number;
  quizzes_played: number;
  quizzes_created: number;
  current_streak: number;
  longest_streak: number;
  played_categories: number;
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
  { id: 'quiz_master_50', satisfied: (stats) => stats.quizzes_played >= 50 },
  { id: 'creator', satisfied: (stats) => stats.quizzes_created >= 1 },
  { id: 'perfect_score', satisfied: (_stats, context) => context.perfectScore === true },
  // El umbral lo verifica también unlock_achievement en SQL (018); aquí solo
  // evita pedir el RPC de un logro que aún no toca.
  {
    id: 'week_streak',
    satisfied: (stats) => Math.max(stats.current_streak, stats.longest_streak) >= 7,
  },
  { id: 'explorer', satisfied: (stats) => stats.played_categories >= 5 },
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
 * Carga los contadores que alimentan las condiciones. Las columnas de racha son
 * de la migración 018: si aún no se aplicó, la consulta falla y se cae a los
 * contadores anteriores (racha 0), de modo que los logros viejos siguen
 * desbloqueándose igual que antes.
 */
export async function loadAchievementStats(
  supabase: Client,
  userId: string
): Promise<ProfileStats | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('points, quizzes_played, quizzes_created, current_streak, longest_streak')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    const { data: legacy } = await supabase
      .from('profiles')
      .select('points, quizzes_played, quizzes_created')
      .eq('id', userId)
      .maybeSingle();
    if (!legacy) return null;
    return { ...legacy, current_streak: 0, longest_streak: 0, played_categories: 0 };
  }

  // El conteo de categorías sale de un RPC (018). Sin él, explorer no avanza:
  // es mejor no desbloquearlo que otorgarlo a ciegas.
  const { data: categories } = await supabase.rpc('get_my_played_categories');

  return {
    ...data,
    played_categories: typeof categories === 'number' ? categories : 0,
  };
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

  const stats = await loadAchievementStats(supabase, userId);
  if (!stats) return [];

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
