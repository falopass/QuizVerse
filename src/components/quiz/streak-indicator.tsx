'use client';

import type { Locale } from '@/lib/i18n/dictionaries';

export function StreakIndicator({ streak, locale }: { streak: number; locale: Locale }) {
  if (streak < 2) return null;
  return (
    <span className="arcade-streak">
      {streak}× {locale === 'es' ? 'RACHA' : 'STREAK'}
    </span>
  );
}
