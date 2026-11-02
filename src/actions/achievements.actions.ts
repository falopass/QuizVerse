'use server';

/**
 * Conciliación de logros.
 *
 * `checkAchievements` corre al enviar una partida, así que un logro cuyo
 * contador ya cumple la meta pero que nunca se desbloqueó (lo alcanzó antes de
 * aplicar la migración 018, o el desbloqueo falló tras la partida) se quedaría
 * «Bloqueado» con la barra llena. Esta acción lo concede con el mismo RPC que
 * valida la condición en SQL y paga el premio una sola vez.
 *
 * Es una mutación, no parte del render: la página de logros solo la invoca
 * desde el cliente cuando detecta pendientes.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAchievement } from '@/lib/data/normalizers';
import { pendingAchievements } from '@/lib/quiz/achievement-progress';
import { loadAchievementStats } from '@/lib/quiz/achievements';

export interface ReconcileResult {
  /** Ids que se concedieron en esta llamada. */
  unlocked: string[];
}

export async function reconcileAchievements(locale: string): Promise<ReconcileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { unlocked: [] };

  const [stats, catalogResult, ownedResult] = await Promise.all([
    loadAchievementStats(supabase, user.id),
    supabase.from('achievements').select('*'),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', user.id),
  ]);
  if (!stats) return { unlocked: [] };

  const owned = new Set((ownedResult.data ?? []).map((row) => row.achievement_id));
  const pending = pendingAchievements(
    (catalogResult.data ?? []).map(normalizeAchievement),
    owned,
    stats
  );

  const unlocked: string[] = [];
  for (const achievement of pending) {
    const { data, error } = await supabase.rpc('unlock_achievement', {
      p_achievement_id: achievement.id,
    });
    // `false` es «ya lo tenía» o «la condición no se cumple en SQL»: no es un
    // error y no hay nada que reintentar aquí.
    if (!error && data === true) unlocked.push(achievement.id);
  }

  if (unlocked.length > 0) revalidatePath(`/${locale}/achievements`);
  return { unlocked };
}
