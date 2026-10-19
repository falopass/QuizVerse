import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Unlocked achievements, private and login-gated: never indexed. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Mis logros' : 'My achievements',
    description: es
      ? 'Los logros que has desbloqueado jugando y creando quizzes.'
      : 'The achievements you have unlocked by playing and creating quizzes.',
    path: `/${lang}/achievements`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedAchievementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/achievements'))}`
      )
    );
  }

  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at, achievements(*)')
    .eq('user_id', user.id)
    .order('unlocked_at', { ascending: false });

  const es = locale === 'es';
  const unlocked = (data ?? []).flatMap((row) => {
    const achievement = Array.isArray(row.achievements)
      ? row.achievements[0]
      : row.achievements;
    return achievement ? [{ ...achievement, unlocked_at: row.unlocked_at }] : [];
  });

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Colección' : 'Collection'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Mis logros' : 'My achievements'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Todo lo que has desbloqueado jugando y creando quizzes.'
            : 'Everything you have unlocked by playing and creating quizzes.'}
        </p>
      </section>
      {unlocked.length === 0 ? (
        <section className="surface-card mt-8 p-10 text-center">
          <h2 className="text-text-primary text-2xl font-semibold">
            {es ? 'Aún no has desbloqueado logros' : "You haven't unlocked any achievements yet"}
          </h2>
          <p className="text-text-secondary mt-2">
            {es ? 'Juega un quiz para empezar.' : 'Play a quiz to get started.'}
          </p>
          <Link
            href={localizeHref(locale, '/quiz')}
            className="bg-accent-primary hover:bg-accent-hover mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 font-medium text-white transition-colors"
          >
            {es ? 'Explorar quizzes' : 'Browse quizzes'}
          </Link>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {unlocked.map((achievement) => {
            const date = new Date(achievement.unlocked_at).toLocaleDateString(
              es ? 'es-ES' : 'en-US',
              { day: 'numeric', month: 'short', year: 'numeric' }
            );
            return (
              <li key={achievement.id} className="surface-card flex items-start gap-4 p-5">
                <span aria-hidden="true" className="text-3xl leading-none">
                  {achievement.icon}
                </span>
                <div className="min-w-0">
                  <h2 className="text-text-primary font-semibold">{achievement.name}</h2>
                  <p className="text-text-secondary mt-1 text-sm">{achievement.description}</p>
                  <p className="text-text-muted mt-2 text-xs">
                    {es ? `Desbloqueado el ${date}` : `Unlocked ${date}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
