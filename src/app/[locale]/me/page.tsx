import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyActivity } from '@/lib/data/me';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Historial de partidas del jugador, privado y con login: nunca indexado. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Mi actividad' : 'My activity',
    description: es
      ? 'Tus últimas partidas, con su puntaje y el enlace a cada resultado.'
      : 'Your latest games, with their score and the link to each result.',
    path: `/${lang}/me`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedMePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(locale, `/login?redirect=${encodeURIComponent(localizeHref(locale, '/me'))}`)
    );
  }

  const { sessions, played, points, currentStreak, longestStreak, sessionsFailed } =
    await getMyActivity(user.id);
  const es = locale === 'es';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Cuenta' : 'Account'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Mi actividad' : 'My activity'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Tus últimas partidas, con su puntaje y el enlace a cada resultado.'
            : 'Your latest games, with their score and the link to each result.'}
        </p>
        <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="surface-card p-4">
            <dt className="text-text-muted text-xs font-bold uppercase">
              {es ? 'Partidas' : 'Games played'}
            </dt>
            <dd className="text-text-primary mt-1 text-3xl font-semibold">{played}</dd>
          </div>
          <div className="surface-card p-4">
            <dt className="text-text-muted text-xs font-bold uppercase">
              {es ? 'Puntos' : 'Points'}
            </dt>
            <dd className="text-text-primary mt-1 text-3xl font-semibold">{points}</dd>
          </div>
          <div className="surface-card p-4">
            <dt className="text-text-muted text-xs font-bold uppercase">
              {es ? 'Racha' : 'Streak'}
            </dt>
            <dd className="text-text-primary mt-1 text-3xl font-semibold">
              {currentStreak}{' '}
              <span className="text-text-muted ml-1 text-sm font-normal">
                {es ? (currentStreak === 1 ? 'día' : 'días') : currentStreak === 1 ? 'day' : 'days'}
              </span>
            </dd>
            <p className="text-text-muted mt-1 text-xs">
              {es ? `Mejor racha: ${longestStreak}` : `Best streak: ${longestStreak}`}
            </p>
          </div>
        </dl>
      </section>

      {sessionsFailed ? (
        <section className="surface-card mt-8 p-10 text-center">
          <h2 className="text-text-primary text-2xl font-semibold">
            {es ? 'No pudimos cargar tu historial' : 'We could not load your history'}
          </h2>
          <p className="text-text-secondary mt-2">
            {es ? 'Inténtalo de nuevo en unos minutos.' : 'Try again in a few minutes.'}
          </p>
          <Link
            href={localizeHref(locale, '/me')}
            className="bg-accent-primary hover:bg-accent-hover mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium text-white transition-colors"
          >
            {es ? 'Reintentar' : 'Retry'}
          </Link>
        </section>
      ) : sessions.length === 0 ? (
        <section className="surface-card mt-8 p-10 text-center">
          <h2 className="text-text-primary text-2xl font-semibold">
            {es ? 'Aún no has jugado' : "You haven't played yet"}
          </h2>
          <p className="text-text-secondary mt-2">
            {es
              ? 'Juega un quiz y tu historial aparecerá aquí.'
              : 'Play a quiz and your history will show up here.'}
          </p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="bg-accent-primary hover:bg-accent-hover mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium text-white transition-colors"
          >
            {es ? 'Explorar quizzes' : 'Browse quizzes'}
          </Link>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4">
          {sessions.map((session) => {
            const date = new Date(session.completed_at).toLocaleDateString(es ? 'es' : 'en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const outcome = session.result_title ?? `${session.score}/${session.max_score}`;
            const body = (
              <>
                <div className="min-w-0">
                  <h2 className="text-text-primary group-hover:text-accent-primary truncate font-semibold transition-colors">
                    {session.quiz?.title ?? (es ? 'Quiz no disponible' : 'Quiz unavailable')}
                  </h2>
                  <p className="text-text-muted mt-1 text-xs">{date}</p>
                </div>
                <p className="text-accent-primary shrink-0 font-semibold">{outcome}</p>
              </>
            );
            return (
              <li key={session.id}>
                {session.quiz ? (
                  <Link
                    href={localizeHref(
                      hasLocale(session.quiz.language) ? session.quiz.language : locale,
                      `/quiz/${session.quiz.slug}/result?s=${session.share_token}`
                    )}
                    className="surface-card group flex min-h-11 items-center justify-between gap-4 p-5 transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="surface-card flex min-h-11 items-center justify-between gap-4 p-5">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
