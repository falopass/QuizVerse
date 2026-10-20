'use client';

import * as React from 'react';
import Link from 'next/link';
import { QuizCoverArt } from '@/components/shared/quiz-cover-art';
import { getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { readRecent, type RecentQuiz } from '@/lib/history/recent-quizzes';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: {
    eyebrow: 'Recientes',
    title: 'Vuelve a jugar',
    body: 'Tus últimas partidas quedan guardadas en este dispositivo.',
    play: 'Jugar',
  },
  en: {
    eyebrow: 'Recently played',
    title: 'Pick up where you left off',
    body: 'Your last games stay saved on this device.',
    play: 'Play',
  },
} as const;

interface RecentlyPlayedProps {
  locale: Locale;
}

/**
 * «Vuelve a jugar»: el historial vive en localStorage, así que no hay nada que
 * pintar en SSR. El primer render devuelve null en servidor y cliente (sin
 * desajuste de hidratación) y la sección aparece tras montar, solo con datos.
 */
export function RecentlyPlayed({ locale }: RecentlyPlayedProps) {
  const [entries, setEntries] = React.useState<RecentQuiz[] | null>(null);

  React.useEffect(() => {
    setEntries(readRecent());
  }, []);

  if (!entries || entries.length === 0) return null;
  const copy = locale === 'es' ? COPY.es : COPY.en;

  return (
    <section className="arcade-related">
      <div className="arcade-section-head">
        <div>
          <span className="arcade-tag">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
        </div>
        <p>{copy.body}</p>
      </div>
      <div className="arcade-grid">
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            href={localizeHref(entry.locale, `/quiz/${entry.slug}`)}
            className="arcade-card"
          >
            <QuizCoverArt
              quiz={{
                slug: entry.slug,
                title: entry.title,
                quiz_type: entry.quizType,
                category: null,
                cover_image_url: entry.coverImageUrl,
              }}
              locale={locale}
              compact
              decorative
              className="arcade-card-art"
            />
            <div className="arcade-card-info">
              <span className="arcade-tag">
                {getLocalizedTypeLabel(entry.quizType, locale)} /{' '}
                {entry.categoryName ?? 'QuizVerse'}
              </span>
              <h3>{entry.title}</h3>
              <div className="arcade-card-bottom">
                <small>
                  {entry.minutes} MIN{entry.score ? ` · ${entry.score}` : ''}
                </small>
                <span className="arcade-card-play">{copy.play} ↗</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
