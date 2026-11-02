import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLeaderboard } from '@/lib/data/public';
import { formatCompactNumber } from '@/lib/utils/format';
import { getCopy, getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { rankFriends } from '@/lib/profile/friends-ranking';
import { getWeeklyLeaderboard, getWeeklyRank } from '@/lib/profile/weekly-ranking';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { leaderboardOgImage } from '@/lib/seo/site';
import { breadcrumbNode, buildGraph, webPageNode } from '@/lib/seo/structured-data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  const copy = (await getDictionary(locale)).leaderboard;

  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/leaderboard`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/leaderboard`,
    locale,
    image: leaderboardOgImage(locale),
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
  searchParams: Promise<{ scope?: string; tab?: string }>;
}) {
  const [{ locale }, { scope, tab }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const copy = dictionary.leaderboard;
  const isFriends = scope === 'friends';
  // `?tab=weekly` es el nombre canónico en inglés; `semanal` se mantiene por
  // los enlaces ya compartidos.
  const isWeekly = !isFriends && (tab === 'semanal' || tab === 'weekly');
  const supabase = await createClient();
  // `null` en el board = la consulta falló: se muestra aviso con reintento, no
  // el estado vacío (igual que `friendsFailed`).
  let weeklyFailed = false;
  let globalFailed = false;
  const [{ data: auth }, leaderboard] = await Promise.all([
    supabase.auth.getUser(),
    isFriends
      ? Promise.resolve(null)
      : isWeekly
        ? getWeeklyLeaderboard(50)
            .then((result) => result.entries)
            .catch(() => {
              weeklyFailed = true;
              return null;
            })
        : getLeaderboard(50)
            .then((result) => result.entries)
            .catch(() => {
              globalFailed = true;
              return null;
            }),
  ]);
  const currentUser = auth.user;

  // `null` = scope friends sin sesión: el ranking entre amigos necesita saber
  // a quién sigues, así que ahí se muestra el aviso de login.
  let entries: BoardEntry[] | null;
  let noFollows = false;
  let friendsFailed = false;

  if (!isFriends) {
    entries =
      weeklyFailed || globalFailed
        ? null
        : (leaderboard ?? []).map((entry) => ({
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
    const { data: follows, error: followsError } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    if (followsError) {
      friendsFailed = true;
      entries = [];
    } else if (follows.length === 0) {
      // Sin seguidos no hay ranking de amigos: pintar la fila propia como #1
      // junto al aviso «no sigues a nadie» se contradecía (SOC-07).
      noFollows = true;
      entries = [];
    } else {
      const ids = [currentUser.id, ...follows.map((f) => f.following_id)];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids);
      if (profilesError) {
        friendsFailed = true;
        entries = [];
      } else {
        entries = rankFriends(profiles, currentUser.id).map((entry) => ({
          ...entry,
          name: entry.displayName || entry.username,
        }));
      }
    }
  }

  const currentEntry = entries?.find((entry) => entry.isMe) ?? null;

  // Puesto propio fuera del top mostrado (SOC-03/SOC-14): solo con sesión y
  // cuando el jugador no aparece en la lista. Global: cuenta de perfiles por
  // delante (mismo orden points/quizzes_played). Semanal: RPC
  // get_weekly_rank; si la migración aún no está aplicada o falla, null y se
  // muestra el aviso genérico de «fuera del tablero», nunca un CTA de login.
  let myRank: number | null = null;
  if (!isFriends && currentUser && entries !== null && entries.length > 0 && !currentEntry) {
    myRank = isWeekly
      ? await getWeeklyRank(currentUser.id).catch(() => null)
      : await getGlobalRank(supabase, currentUser.id).catch(() => null);
  }

  const trail = [
    { name: dictionary.common.home, href: `/${locale}` },
    { name: copy.title, href: `/${locale}/leaderboard` },
  ];
  type BoardTab = 'global' | 'weekly' | 'friends';
  const activeTab: BoardTab = isFriends ? 'friends' : isWeekly ? 'weekly' : 'global';
  const tabHref = (value: BoardTab) =>
    localizeHref(
      locale,
      value === 'friends'
        ? '/leaderboard?scope=friends'
        : value === 'weekly'
          ? '/leaderboard?tab=semanal'
          : '/leaderboard'
    );
  const tabLabel = (value: BoardTab) => {
    if (value === 'global') return copy.tabGlobal;
    if (value === 'weekly') return copy.tabWeekly;
    return copy.tabFriends;
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pt-28 pb-20">
      <JsonLd
        data={buildGraph([
          webPageNode(`/${locale}/leaderboard`, locale, copy.title),
          breadcrumbNode(trail.map(({ name, href }) => ({ name, path: href }))),
        ])}
      />
      <Breadcrumbs locale={locale} items={trail} className="mb-6" />
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{dictionary.common.leaderboard}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
          <div>
            <h1 className="text-text-primary text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.headline}
            </h1>
            <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">{copy.body}</p>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <MetricCard label={copy.visiblePlayers} value={String(entries?.length ?? 0)} />
            <MetricCard
              label={copy.yourSpot}
              value={currentEntry ? `#${currentEntry.rank}` : myRank ? `#${myRank}` : '—'}
            />
          </div>
        </div>
      </section>

      <nav className="mt-8 flex gap-2" aria-label={copy.scopeLabel}>
        {(['global', 'weekly', 'friends'] as const).map((value) => (
          <Link
            key={value}
            href={tabHref(value)}
            aria-current={activeTab === value ? 'page' : undefined}
            className={
              activeTab === value
                ? 'bg-accent-primary text-bg-primary inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold'
                : 'ring-border-subtle text-text-secondary inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold ring-1'
            }
          >
            {tabLabel(value)}
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

      {!isFriends && !isWeekly && entries !== null && entries.length === 0 && (
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">{copy.tabGlobal}</p>
          <h2 className="text-text-primary mt-2 text-2xl font-semibold">{copy.emptyTitle}</h2>
          <p className="text-text-secondary mt-2 max-w-xl text-sm leading-6">{copy.emptyBody}</p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="bg-accent-primary text-bg-primary mt-4 inline-flex min-h-11 items-center rounded-full px-5 py-3 text-sm font-semibold"
          >
            {copy.emptyCta}
          </Link>
        </section>
      )}

      {!isFriends && !isWeekly && entries === null && (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{copy.tabGlobal}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">{copy.failedTitle}</h2>
            </div>
            <Link
              href={tabHref('global')}
              className="bg-accent-primary text-bg-primary inline-flex min-h-11 items-center rounded-full px-5 py-3 text-sm font-semibold"
            >
              {dictionary.error.retry}
            </Link>
          </div>
        </section>
      )}

      {isWeekly && entries === null && (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{copy.tabWeekly}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                {copy.weeklyFailedTitle}
              </h2>
            </div>
            <Link
              href={tabHref('weekly')}
              className="bg-accent-primary text-bg-primary rounded-full px-5 py-3 text-sm font-semibold"
            >
              {dictionary.error.retry}
            </Link>
          </div>
        </section>
      )}

      {isWeekly && entries !== null && entries.length === 0 && (
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">{copy.tabWeekly}</p>
          <h2 className="text-text-primary mt-2 text-2xl font-semibold">{copy.weeklyEmptyTitle}</h2>
          <p className="text-text-secondary mt-2 max-w-xl text-sm leading-6">
            {copy.weeklyEmptyBody}
          </p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="text-accent-primary mt-4 inline-block text-sm font-semibold"
          >
            {copy.exploreCta}
          </Link>
        </section>
      )}

      {isFriends && entries === null && (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{copy.tabFriends}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                {copy.friendsSignInTitle}
              </h2>
            </div>
            <Link
              href={localizeHref(
                locale,
                `/login?redirect=${encodeURIComponent(tabHref('friends'))}`
              )}
              className="bg-accent-primary text-bg-primary rounded-full px-5 py-3 text-sm font-semibold"
            >
              {copy.signInCta}
            </Link>
          </div>
        </section>
      )}

      {isFriends && friendsFailed && (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{copy.tabFriends}</p>
              <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                {copy.friendsFailedTitle}
              </h2>
            </div>
            <Link
              href={tabHref('friends')}
              className="bg-accent-primary text-bg-primary rounded-full px-5 py-3 text-sm font-semibold"
            >
              {dictionary.error.retry}
            </Link>
          </div>
        </section>
      )}

      {isFriends && noFollows && (
        <section className="surface-card mt-6 p-6">
          <p className="eyebrow">{copy.tabFriends}</p>
          <h2 className="text-text-primary mt-2 text-2xl font-semibold">{copy.noFollowsTitle}</h2>
          <p className="text-text-secondary mt-2 max-w-xl text-sm leading-6">
            {copy.noFollowsBody}
          </p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="text-accent-primary mt-4 inline-block text-sm font-semibold"
          >
            {copy.exploreCta}
          </Link>
        </section>
      )}

      {!isFriends && entries !== null && entries.length > 0 && !currentEntry && (
        <section className="surface-card mt-10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {currentUser ? (
              <>
                <div>
                  <p className="eyebrow">{copy.yourRank}</p>
                  <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                    {myRank !== null ? `#${myRank}` : copy.outsideTopTitle}
                  </h2>
                  <p className="text-text-secondary mt-2 max-w-xl text-sm leading-6">
                    {copy.outsideTopBody}
                  </p>
                </div>
                <Link
                  href={localizeHref(locale, '/quiz')}
                  className="bg-accent-primary text-bg-primary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  {copy.exploreCta}
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="eyebrow">{copy.yourRank}</p>
                  <h2 className="text-text-primary mt-2 text-2xl font-semibold">
                    {copy.signInTitle}
                  </h2>
                </div>
                <Link
                  href={localizeHref(
                    locale,
                    `/login?redirect=${encodeURIComponent(tabHref(activeTab))}`
                  )}
                  className="bg-accent-primary text-bg-primary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  {copy.signInCta}
                </Link>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Puesto en el tablero global de un jugador fuera del top: perfiles por
 * delante con el mismo desempate que `getLeaderboard` (points DESC,
 * quizzes_played DESC). null si alguna consulta falla.
 */
async function getGlobalRank(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number | null> {
  const { data: me, error } = await supabase
    .from('profiles')
    .select('points, quizzes_played')
    .eq('id', userId)
    .maybeSingle();

  if (error || !me) return null;

  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or(
      `points.gt.${me.points},and(points.eq.${me.points},quizzes_played.gt.${me.quizzes_played})`
    );

  if (countError || count === null) return null;
  return count + 1;
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
  const copy = getCopy(locale, 'leaderboard');

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
          {formatCompactNumber(entry.quizzesPlayed, locale)} {copy.quizzesPlayed}
        </p>
      </div>
      <div className="text-right">
        <p className="text-accent-primary text-2xl font-semibold">
          {formatCompactNumber(entry.points, locale)}
        </p>
        <p className="text-text-muted text-xs tracking-[0.16em] uppercase">{copy.points}</p>
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
