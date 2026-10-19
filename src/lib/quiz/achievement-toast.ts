import type { Locale } from '@/lib/i18n/dictionaries';

/**
 * Spanish labels for the seeded achievements, keyed by their stable `id`. The
 * `achievements` table only stores English names; unknown ids fall back to the
 * server-provided name.
 */
const ACHIEVEMENT_NAMES_ES: Record<string, string> = {
  first_quiz: 'Primeros pasos',
  quiz_addict_10: 'Adicto a los quizzes',
  quiz_master_50: 'Maestro de los quizzes',
  perfect_score: 'Impecable',
  creator: 'Creador de quizzes',
  going_viral: 'Viral',
  internet_famous: 'Famoso en internet',
  week_streak: 'Maestro de la racha',
  explorer: 'Explorador',
  social_butterfly: 'Mariposa social',
};

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

  const names = unlocked.map((achievement) =>
    locale === 'es' ? (ACHIEVEMENT_NAMES_ES[achievement.id] ?? achievement.name) : achievement.name
  );

  return { title, description: names.join(' · ') };
}
