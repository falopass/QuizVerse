'use client';

import * as React from 'react';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { readRecent, type RecentQuiz } from '@/lib/history/recent-quizzes';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: {
    eyebrow: 'Recientes',
    title: 'Vuelve a jugar',
    body: 'Tus últimas partidas quedan guardadas en este dispositivo.',
  },
  en: {
    eyebrow: 'Recently played',
    title: 'Pick up where you left off',
    body: 'Your last games stay saved on this device.',
  },
} as const;

interface RecentlyPlayedProps {
  locale: Locale;
}

/**
 * «Vuelve a jugar»: el historial vive en localStorage, así que no hay nada que
 * pintar en SSR. El primer render devuelve null en servidor y cliente (sin
 * desajuste de hidratación) y la sección aparece tras montar, solo con datos.
 *
 * Usa la misma tarjeta que el resto del catálogo. Los registros guardados no
 * traen el slug de la categoría (ni los viejos ni los nuevos): el acento y el
 * motivo caen al tipo de juego, y el nombre de categoría guardado se muestra
 * tal cual.
 */
export function RecentlyPlayed({ locale }: RecentlyPlayedProps) {
  const [entries, setEntries] = React.useState<RecentQuiz[] | null>(null);

  React.useEffect(() => {
    queueMicrotask(() => setEntries(readRecent()));
  }, []);

  if (!entries || entries.length === 0) return null;
  const copy = locale === 'es' ? COPY.es : COPY.en;

  return (
    <section className="arcade-related qv8-recent" aria-labelledby="qv8-recent-title">
      <div className="arcade-section-head">
        <div>
          <span className="arcade-tag">{copy.eyebrow}</span>
          <h2 id="qv8-recent-title">{copy.title}</h2>
        </div>
        <p>{copy.body}</p>
      </div>
      <div className="arcade-grid">
        {entries.map((entry) => (
          <EditorialQuizCard
            key={entry.slug}
            quiz={{
              slug: entry.slug,
              title: entry.title,
              quiz_type: entry.quizType,
              estimated_minutes: entry.minutes,
              cover_image_url: entry.coverImageUrl,
              category: entry.categoryName ? { name: entry.categoryName } : null,
            }}
            locale={locale}
            hrefLocale={entry.locale}
            extraMeta={entry.score}
            prefetch={false}
          />
        ))}
      </div>
    </section>
  );
}
