import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MyQuizzesList } from '@/components/quiz/my-quizzes-list';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Creator's own submissions, private and login-gated: never indexed. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Mis quizzes' : 'My quizzes',
    description: es
      ? 'Revisa el estado de tus quizzes y borra los que ya no quieras.'
      : 'Check the status of your quizzes and delete the ones you no longer want.',
    path: `/${lang}/my-quizzes`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedMyQuizzesPage({
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
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/my-quizzes'))}`
      )
    );
  }

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, slug, title, status, quiz_type, language, plays_count, likes_count, created_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const es = locale === 'es';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Estudio' : 'Studio'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Mis quizzes' : 'My quizzes'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? 'Todo lo que has enviado, con su estado de revisión. Borra lo que ya no te represente.'
            : 'Everything you have submitted, with its review status. Delete what no longer represents you.'}
        </p>
      </section>
      <MyQuizzesList quizzes={quizzes ?? []} locale={locale} />
    </div>
  );
}
