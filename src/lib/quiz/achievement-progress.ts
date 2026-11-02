import type { Achievement } from '@/types/quiz';

/**
 * Logros sembrados cuyas métricas el producto todavía no registra de forma
 * fiable (`shares`, plays del quiz creado). Siguen en el catálogo para no tocar
 * datos, pero no se muestran: enseñar una barra que nunca avanza es peor que no
 * enseñar el logro.
 */
export const HIDDEN_ACHIEVEMENT_IDS = new Set([
  'going_viral',
  'internet_famous',
  'social_butterfly',
]);

/** El catálogo guarda el icono como nombre (`crown`), no como glifo. */
export const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_quiz: '🎯',
  quiz_addict_10: '🔥',
  quiz_master_50: '👑',
  perfect_score: '💎',
  creator: '✏️',
  week_streak: '📅',
  explorer: '🗺️',
};

export interface AchievementStats {
  quizzes_played: number;
  quizzes_created: number;
  current_streak: number;
  longest_streak: number;
  played_categories: number;
}

export type ProgressUnit = 'plays' | 'creates' | 'days' | 'categories';

export interface AchievementProgress {
  current: number;
  target: number;
  unit: ProgressUnit;
}

/**
 * Progreso hacia un logro bloqueado, con el mismo `condition_type` /
 * `condition_value` del catálogo que valida `unlock_achievement` en SQL: la
 * barra no puede prometer algo que el servidor no vaya a conceder.
 *
 * `score` (partida perfecta) es binario y no tiene contador: devuelve null y la
 * tarjeta explica la condición en palabras.
 */
export function achievementProgress(
  achievement: Pick<Achievement, 'condition_type' | 'condition_value'>,
  stats: AchievementStats
): AchievementProgress | null {
  const target = Math.max(achievement.condition_value, 1);

  switch (achievement.condition_type) {
    case 'plays':
      return { current: stats.quizzes_played, target, unit: 'plays' };
    case 'creates':
      return { current: stats.quizzes_created, target, unit: 'creates' };
    case 'streak':
      // La racha de 7 pudo completarse antes de la migración 018 y el logro no
      // debe perderse: la barra mira el máximo, igual que el SQL.
      return {
        current: Math.max(stats.current_streak, stats.longest_streak),
        target,
        unit: 'days',
      };
    case 'categories':
      return { current: stats.played_categories, target, unit: 'categories' };
    default:
      return null;
  }
}

/**
 * Logros cuyo contador ya cumple la meta pero que el jugador no tiene: los que
 * alcanzó antes de aplicar la 018 o cuyo desbloqueo no llegó a correr. Sin
 * esto, la tarjeta diría «50/50» y «Bloqueado» a la vez.
 *
 * Solo lectura: quien los concede es la acción `reconcileAchievements`, nunca
 * el render de la página.
 */
export function pendingAchievements(
  catalog: Achievement[],
  ownedIds: ReadonlySet<string>,
  stats: AchievementStats
): Achievement[] {
  return catalog.filter((achievement) => {
    if (HIDDEN_ACHIEVEMENT_IDS.has(achievement.id) || ownedIds.has(achievement.id)) return false;
    const progress = achievementProgress(achievement, stats);
    return progress !== null && progress.current >= progress.target;
  });
}
