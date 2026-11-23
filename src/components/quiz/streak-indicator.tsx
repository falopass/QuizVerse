'use client';

import type { Locale } from '@/lib/i18n/dictionaries';

export function StreakIndicator({ streak, locale }: { streak: number; locale: Locale }) {
  if (streak < 2) return null;
  // La key por valor re-monta el número al subir la racha y repite el pop.
  return (
    <span className="arcade-streak">
      <span key={streak} className="qv-l1-streak-pop">
        {streak}×
      </span>{' '}
      {locale === 'es' ? 'Racha' : 'Streak'}
    </span>
  );
}
