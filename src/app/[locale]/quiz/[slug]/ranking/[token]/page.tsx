import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getQuizBySlug, getQuizLocaleRedirect } from '@/lib/data/public';
import { fetchGroupByToken, fetchGroupEntries } from '@/lib/data/group';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { isGroupToken } from '@/lib/quiz/group';
import { buildMetadata } from '@/lib/seo/metadata';
import { quizOgImage } from '@/lib/seo/site';
import { createClient } from '@/lib/supabase/server';
import { GroupLeaderboard } from '@/components/quiz/group-leaderboard';

/**
 * Vista ligera del ranking del grupo (`?g=`): solo lectura por token, sin
 * alta (para entrar hay que jugar). Noindex: es una URL derivada compartida
 * en chats, no contenido indexable.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}): Promise<Metadata> {
  const { locale, slug, token } = await params;
  if (!hasLocale(locale) || !isGroupToken(token)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  const es = locale === 'es';
  return buildMetadata({
    title: es ? `Ranking del grupo en ${quiz.title}` : `Group leaderboard in ${quiz.title}`,
    description: es
      ? 'Mira quién lidera el grupo y juega para entrar al ranking.'
      : 'See who leads the group and play to join the leaderboard.',
    path: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}/ranking/${token}`,
    image: quizOgImage(locale, quiz.slug),
    imageAlt: quiz.title,
    locale,
    noindex: true,
  });
}

export default async function GroupRankingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}) {
  const { locale, slug, token } = await params;
  if (!hasLocale(locale) || !isGroupToken(token)) notFound();

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) {
    const target = await getQuizLocaleRedirect(slug, locale, { keepSameQuiz: true });
    if (target) {
      permanentRedirect(`/${target.locale}/quiz/${target.slug}/ranking/${token}`);
    }
    notFound();
  }

  const supabase = await createClient();
  const groupRead = await fetchGroupByToken(supabase, token);
  const group =
    groupRead.state === 'ok' && groupRead.value?.quizId === quiz.id ? groupRead.value : null;

  const es = locale === 'es';
  const playHref = `${localizeHref(locale, `/quiz/${quiz.slug}/play`)}?g=${token}`;

  // Token sin grupo en este quiz (o migración pendiente): un estado vacío
  // honesto con CTA a jugar, igual que /result sin sesión.
  if (!group) {
    return (
      <div className="arcade-wrap">
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-16">
          <div>
            <p className="eyebrow text-accent-primary text-[11px] font-semibold">
              {es ? 'Ranking del grupo' : 'Group leaderboard'}
            </p>
            <h1 className="font-display text-text-primary mt-2 text-3xl font-bold md:text-4xl">
              {es ? 'Este ranking no está disponible' : 'This leaderboard is not available'}
            </h1>
            <p className="text-text-secondary mt-3 text-base leading-7">
              {es
                ? 'El enlace puede haber expirado o aún no está activo. Juega el quiz para crear tu propio grupo.'
                : 'The link may have expired or is not active yet. Play the quiz to create your own group.'}
            </p>
            <Link
              href={localizeHref(locale, `/quiz/${quiz.slug}/play`)}
              className="arcade-result-ranking mt-6 inline-flex min-h-11 items-center"
            >
              {es ? 'Jugar ahora' : 'Play now'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const entriesRead = await fetchGroupEntries(supabase, token);
  const entries = entriesRead.state === 'ok' ? (entriesRead.value ?? []) : [];

  return (
    <div className="arcade-wrap">
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-10 md:py-16">
        <p className="eyebrow text-accent-primary text-[11px] font-semibold">
          {es ? 'Ranking del grupo' : 'Group leaderboard'}
        </p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold md:text-4xl">
          {quiz.title}
        </h1>
        <p className="text-text-secondary mt-2 text-sm">
          {es
            ? `${group.creatorNickname} armó este grupo. Juega para entrar al ranking.`
            : `${group.creatorNickname} started this group. Play to join the leaderboard.`}
        </p>

        <div className="mt-6">
          <GroupLeaderboard
            locale={locale}
            groupToken={token}
            creatorNickname={group.creatorNickname}
            initialEntries={entries}
            playerCount={group.playerCount}
            readOnly
          />
        </div>

        <Link
          href={playHref}
          className="arcade-button arcade-result-primary mt-6 inline-flex min-h-11 items-center"
        >
          {es ? 'Jugar y entrar' : 'Play and join'}
        </Link>
      </div>
    </div>
  );
}
