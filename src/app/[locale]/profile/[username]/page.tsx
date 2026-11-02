import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import {
  getProfileByUsername,
  getQuizzesByCreatorId,
  getUnlockedAchievements,
} from '@/lib/data/public';
import { formatCompactNumber } from '@/lib/utils/format';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { achievementCopy } from '@/lib/i18n/achievements';
import { ACHIEVEMENT_ICONS } from '@/lib/quiz/achievement-progress';
import { liveStreak } from '@/lib/quiz/streak';
import { localizedPath, generateProfileMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import { ShareButtons } from '@/components/shared/share-buttons';
import { FollowButton } from '@/components/profile/follow-button';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  // Un fallo de la consulta no puede tumbar la metadata (la página tiene su
  // error boundary); solo un perfil inexistente deja la metadata vacía.
  const profile = await getProfileByUsername(username).catch(() => null);
  if (!profile) {
    return {};
  }

  return generateProfileMetadata({
    username,
    displayName: profile.display_name ?? undefined,
    bio: profile.bio ?? undefined,
    quizzesCreated: profile.quizzes_created,
    locale,
  });
}

export default async function LocalizedProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  if (!hasLocale(locale)) notFound();

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;
  const streak = liveStreak(profile.current_streak, profile.last_played_on);

  const [quizzes, achievements, countsRow, followRow] = await Promise.all([
    getQuizzesByCreatorId(profile.id),
    getUnlockedAchievements(profile.id),
    supabase
      .from('profiles')
      .select('followers_count, following_count')
      .eq('id', profile.id)
      .single(),
    user && !isOwnProfile
      ? supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .eq('following_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{locale === 'es' ? 'Perfil' : 'Profile'}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
          <div>
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                // El avatar viene de OAuth y el host es arbitrario: next/image
                // lo rechazaría por no estar en remotePatterns.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-bg-tertiary text-accent-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
                >
                  {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                </span>
              )}
              <h1 className="text-text-primary text-4xl font-semibold tracking-tight md:text-6xl">
                {profile.display_name || profile.username}
              </h1>
            </div>
            <p className="text-text-muted mt-3 text-sm tracking-[0.18em] uppercase">
              @{profile.username}
            </p>
            <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">
              {profile.bio ||
                (locale === 'es'
                  ? 'Un perfil de QuizVerse en construcción, con quizzes publicados y una huella editorial propia.'
                  : 'A QuizVerse profile with published quizzes and a visible editorial footprint.')}
            </p>
            <div className="mt-6 flex max-w-md flex-col items-start gap-4">
              {!isOwnProfile ? (
                <FollowButton
                  targetUserId={profile.id}
                  initialFollowing={Boolean(followRow.data)}
                  isAuthenticated={Boolean(user)}
                  locale={locale}
                />
              ) : null}
              <ShareButtons
                locale={locale}
                title={`${profile.display_name || profile.username} · QuizVerse`}
                url={absoluteUrl(localizedPath(locale, `/profile/${profile.username}`))}
                text={
                  locale === 'es'
                    ? 'Mira este perfil en QuizVerse.'
                    : 'Check out this profile on QuizVerse.'
                }
              />
            </div>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <StatCard
              value={formatCompactNumber(profile.points, locale)}
              label={locale === 'es' ? 'Puntos' : 'Points'}
            />
            <StatCard
              value={formatCompactNumber(profile.quizzes_played, locale)}
              label={locale === 'es' ? 'Jugados' : 'Played'}
            />
            <StatCard
              value={
                locale === 'es'
                  ? `${streak} ${streak === 1 ? 'día' : 'días'}`
                  : `${streak} ${streak === 1 ? 'day' : 'days'}`
              }
              label={locale === 'es' ? 'Racha actual' : 'Current streak'}
            />
            <StatCard
              value={formatCompactNumber(profile.quizzes_created, locale)}
              label={locale === 'es' ? 'Creados' : 'Created'}
            />
            <StatCard
              value={formatCompactNumber(countsRow.data?.followers_count ?? 0, locale)}
              label={locale === 'es' ? 'Seguidores' : 'Followers'}
              href={localizeHref(
                locale,
                `/profile/${encodeURIComponent(profile.username)}/followers`
              )}
            />
            <StatCard
              value={formatCompactNumber(countsRow.data?.following_count ?? 0, locale)}
              label={locale === 'es' ? 'Siguiendo' : 'Following'}
              href={localizeHref(
                locale,
                `/profile/${encodeURIComponent(profile.username)}/following`
              )}
            />
          </div>
        </div>
      </section>

      {achievements.length > 0 ? (
        <section className="surface-card mt-8 p-6">
          <p className="eyebrow">{locale === 'es' ? 'Logros' : 'Achievements'}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {achievements.slice(0, 6).map((achievement) => (
              <div
                key={achievement.id}
                className="border-border-subtle bg-bg-primary text-text-secondary rounded-full border px-4 py-2 text-sm"
              >
                <span aria-hidden="true">
                  {ACHIEVEMENT_ICONS[achievement.id] ?? achievement.icon}
                </span>{' '}
                {achievementCopy(achievement.id, locale, achievement).name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{locale === 'es' ? 'Quizzes publicados' : 'Published quizzes'}</p>
          <h2 className="font-display text-text-primary mt-2 text-4xl">
            {locale === 'es' ? 'Trabajo visible en el catálogo' : 'Visible work in the catalog'}
          </h2>
        </div>
      </section>

      {quizzes.length === 0 ? (
        <section className="surface-card mt-6 p-6">
          <p className="text-text-secondary max-w-xl text-sm leading-6">
            {locale === 'es'
              ? 'Este perfil todavía no tiene quizzes publicados.'
              : 'This profile has no published quizzes yet.'}
          </p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="text-accent-primary mt-4 inline-block text-sm font-semibold"
          >
            {locale === 'es' ? 'Explorar quizzes' : 'Explore quizzes'}
          </Link>
        </section>
      ) : (
        <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz, index) => (
            <EditorialQuizCard key={quiz.id} quiz={quiz} index={index} locale={locale} />
          ))}
        </section>
      )}
    </div>
  );
}

function StatCard({ value, label, href }: { value: string; label: string; href?: string }) {
  const body = (
    <>
      <p className="text-text-primary text-3xl font-semibold">{value}</p>
      <p className="text-text-muted mt-2 text-sm">{label}</p>
    </>
  );
  const classes =
    'border-border-subtle bg-bg-primary/80 block rounded-[1.5rem] border p-5 text-center';

  return href ? (
    <Link href={href} className={`${classes} hover:border-accent-primary/40 transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
