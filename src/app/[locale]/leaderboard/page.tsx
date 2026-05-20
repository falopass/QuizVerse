import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLeaderboard } from '@/lib/data/public';
import { formatCompactNumber } from '@/lib/utils/format';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { generateQuizMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  return generateQuizMetadata({
    title: locale === 'es' ? 'Ranking QuizVerse' : 'QuizVerse leaderboard',
    description:
      locale === 'es'
        ? 'Mira quién está liderando el tablero de QuizVerse.'
        : 'See who is leading the QuizVerse board.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale}/leaderboard`,
    alternateUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale === 'es' ? 'en' : 'es'}/leaderboard`,
    locale,
  });
}

export default async function LocalizedLeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const [{ data: auth }, leaderboard] = await Promise.all([
    supabase.auth.getUser(),
    getLeaderboard(50),
  ]);
  const currentUser = auth.user;
  const currentEntry = currentUser
    ? (leaderboard.find((entry) => entry.user.id === currentUser.id) ?? null)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{locale === 'es' ? 'Ranking' : 'Leaderboard'}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
          <div>
            <h1 className="text-text-primary text-4xl font-semibold tracking-tight md:text-6xl">
              {locale === 'es'
                ? 'Las personas que mueven el tablero.'
                : 'The people shaping the board.'}
            </h1>
            <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">
              {locale === 'es'
                ? 'Puntos, partidas y constancia. Aquí aparece quién está convirtiendo QuizVerse en hábito.'
                : 'Points, plays, and consistency. This is where QuizVerse starts looking like a habit.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label={locale === 'es' ? 'Jugadores visibles' : 'Visible players'}
              value={String(leaderboard.length)}
            />
            <MetricCard
              label={locale === 'es' ? 'Tu posición' : 'Your spot'}
              value={currentEntry ? `#${currentEntry.rank}` : '—'}
            />
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        {leaderboard.map((entry, index) => (
          <Link
            key={entry.user.id}
            href={localizeHref(locale, `/profile/${entry.user.username}`)}
            className="surface-card flex items-center gap-4 p-5 transition-transform hover:-translate-y-1"
          >
            <div className="bg-bg-primary text-text-primary ring-border-subtle flex h-14 w-14 items-center justify-center rounded-[1.4rem] text-lg font-semibold ring-1">
              {index < 3 ? ['1', '2', '3'][index] : `#${entry.rank}`}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-text-primary truncate text-lg font-semibold">
                {entry.user.display_name || entry.user.username}
              </h2>
              <p className="text-text-secondary mt-1 text-sm">
                {formatCompactNumber(entry.quizzesPlayed)}{' '}
                {locale === 'es' ? 'quizzes jugados' : 'quizzes played'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-accent-primary text-2xl font-semibold">
                {formatCompactNumber(entry.points)}
              </p>
              <p className="text-text-muted text-xs tracking-[0.16em] uppercase">
                {locale === 'es' ? 'puntos' : 'points'}
              </p>
            </div>
          </Link>
        ))}
      </section>

      {!currentEntry && (
        <section className="surface-card mt-10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{locale === 'es' ? 'Tu puesto' : 'Your rank'}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                {locale === 'es'
                  ? 'Inicia sesión para ver dónde caes.'
                  : 'Sign in to see where you land.'}
              </h2>
            </div>
            <Link
              href={localizeHref(
                locale,
                `/login?redirect=${encodeURIComponent(localizeHref(locale, '/leaderboard'))}`
              )}
              className="bg-accent-primary rounded-full px-5 py-3 text-sm font-semibold text-white"
            >
              {locale === 'es' ? 'Entrar' : 'Sign in'}
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-subtle bg-bg-primary/80 rounded-[1.5rem] border p-5">
      <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
        {label}
      </p>
      <p className="text-text-primary mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}
