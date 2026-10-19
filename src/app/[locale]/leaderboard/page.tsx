import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLeaderboard } from '@/lib/data/public';
import { formatCompactNumber } from '@/lib/utils/format';
import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { rankFriends } from '@/lib/profile/friends-ranking';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  return buildMetadata({
    title: locale === 'es' ? 'Ranking de jugadores' : 'Player leaderboard',
    description:
      locale === 'es'
        ? 'Mira quién lidera el ranking de QuizVerse: puntos, quizzes jugados y los jugadores más activos de la comunidad.'
        : 'See who leads the QuizVerse board: points, quizzes played and the most active players in the community.',
    path: `/${locale}/leaderboard`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/leaderboard`,
    locale,
  });
}

interface BoardEntry {
  rank: number;
  id: string;
  username: string;
  name: string;
  points: number;
  quizzesPlayed: number;
  isMe: boolean;
}

export default async function LocalizedLeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const [{ locale }, { scope }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();

  const isFriends = scope === 'friends';
  const supabase = await createClient();
  const [{ data: auth }, leaderboard] = await Promise.all([
    supabase.auth.getUser(),
    isFriends ? Promise.resolve(null) : getLeaderboard(50),
  ]);
  const currentUser = auth.user;

  // `null` = scope friends sin sesión: el ranking entre amigos necesita saber
  // a quién sigues, así que ahí se muestra el aviso de login.
  let entries: BoardEntry[] | null;
  let noFollows = false;

  if (!isFriends) {
    entries = (leaderboard ?? []).map((entry) => ({
      rank: entry.rank,
      id: entry.user.id,
      username: entry.user.username,
      name: entry.user.display_name || entry.user.username,
      points: entry.points,
      quizzesPlayed: entry.quizzesPlayed,
      isMe: entry.user.id === currentUser?.id,
    }));
  } else if (!currentUser) {
    entries = null;
  } else {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    if (!follows?.length) {
      noFollows = true;
      entries = [];
    } else {
      const ids = [currentUser.id, ...follows.map((f) => f.following_id)];
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
      entries = rankFriends(profiles ?? [], currentUser.id).map((entry) => ({
        ...entry,
        name: entry.displayName || entry.username,
      }));
    }
  }

  const currentEntry = entries?.find((entry) => entry.isMe) ?? null;
  const scopeHref = (value: 'global' | 'friends') =>
    localizeHref(locale, value === 'friends' ? '/leaderboard?scope=friends' : '/leaderboard');

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
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <MetricCard
              label={locale === 'es' ? 'Jugadores visibles' : 'Visible players'}
              value={String(entries?.length ?? 0)}
            />
            <MetricCard
              label={locale === 'es' ? 'Tu posición' : 'Your spot'}
              value={currentEntry ? `#${currentEntry.rank}` : '—'}
            />
          </div>
        </div>
      </section>

      <nav
        className="mt-8 flex gap-2"
        aria-label={locale === 'es' ? 'Alcance del ranking' : 'Leaderboard scope'}
      >
        {(['global', 'friends'] as const).map((value) => (
          <Link
            key={value}
            href={scopeHref(value)}
            aria-current={isFriends === (value === 'friends') ? 'page' : undefined}
            className={
              isFriends === (value === 'friends')
                ? 'bg-accent-primary rounded-full px-4 py-2 text-sm font-semibold text-white'
                : 'ring-border-subtle text-text-secondary rounded-full px-4 py-2 text-sm font-semibold ring-1'
            }
          >
            {value === 'global' ? 'Global' : locale === 'es' ? 'Amigos' : 'Friends'}
          </Link>
        ))}
      </nav>

      {entries !== null && entries.length > 0 && (
        <section className="mt-6 space-y-3">
          {entries.map((entry, index) => (
            <LeaderboardRow key={entry.id} entry={entry} index={index} locale={locale} />
          ))}
        </section>
      )}

      {isFriends && entries === null && (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{locale === 'es' ? 'Amigos' : 'Friends'}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                {locale === 'es'
                  ? 'Inicia sesión para ver el ranking entre amigos.'
                  : 'Sign in to see the friends leaderboard.'}
              </h2>
            </div>
            <Link
              href={localizeHref(
                locale,
                `/login?redirect=${encodeURIComponent(scopeHref('friends'))}`
              )}
              className="bg-accent-primary rounded-full px-5 py-3 text-sm font-semibold text-white"
            >
              {locale === 'es' ? 'Entrar' : 'Sign in'}
            </Link>
          </div>
        </section>
      )}

      {isFriends && noFollows && (
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">{locale === 'es' ? 'Amigos' : 'Friends'}</p>
          <h2 className="text-text-primary mt-2 text-2xl font-semibold">
            {locale === 'es' ? 'Todavía no sigues a nadie.' : 'You are not following anyone yet.'}
          </h2>
          <p className="text-text-secondary mt-2 max-w-xl text-sm leading-6">
            {locale === 'es'
              ? 'Sigue a otros jugadores desde su perfil y este ranking se llena con su actividad y la tuya.'
              : 'Follow other players from their profile and this board fills up with their activity and yours.'}
          </p>
          <Link
            href={localizeHref(locale, '/explore')}
            className="text-accent-primary mt-4 inline-block text-sm font-semibold"
          >
            {locale === 'es' ? 'Explorar quizzes' : 'Explore quizzes'}
          </Link>
        </section>
      )}

      {!isFriends && !currentEntry && (
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

function LeaderboardRow({
  entry,
  index,
  locale,
}: {
  entry: BoardEntry;
  index: number;
  locale: Locale;
}) {
  return (
    <Link
      href={localizeHref(locale, `/profile/${entry.username}`)}
      className="surface-card flex items-center gap-4 p-5 transition-transform hover:-translate-y-1"
    >
      <div className="bg-bg-primary text-text-primary ring-border-subtle flex h-14 w-14 items-center justify-center rounded-[1.4rem] text-lg font-semibold ring-1">
        {index < 3 ? ['1', '2', '3'][index] : `#${entry.rank}`}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-text-primary truncate text-lg font-semibold">{entry.name}</h2>
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
