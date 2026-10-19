import type { Locale } from '@/lib/i18n/dictionaries';

/**
 * Copy for the toast shown when a finished game unlocks achievements.
 *
 * Kept apart from `achievements.ts`, which is server-only (Supabase): the quiz
 * player is a client component and only receives the unlocked rows.
 */
export function achievementToastMessage(
  locale: Locale,
  unlocked: Array<{ id: string; name: string }>
): { title: string; description: string } | null {
  if (unlocked.length === 0) return null;

  const plural = unlocked.length > 1;
  const title =
    locale === 'es'
      ? plural
        ? '¡Logros desbloqueados!'
        : '¡Logro desbloqueado!'
      : plural
        ? 'Achievements unlocked!'
        : 'Achievement unlocked!';

  return { title, description: unlocked.map((achievement) => achievement.name).join(' · ') };
}
