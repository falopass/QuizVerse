import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Post-create landing. A non-admin quiz is inserted with `status = 'pending'`,
 * and the public detail only resolves `published` rows — sending the creator
 * there would 404. RLS lets the owner read their own pending quiz, so this page
 * fetches it scoped by `creator_id` and explains the state instead.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Quiz enviado' : 'Quiz submitted',
    description: es
      ? 'Tu quiz ya está en QuizVerse: el equipo revisa las piezas nuevas antes de publicarlas.'
      : 'Your quiz is in QuizVerse: the team reviews new pieces before publishing them.',
    path: `/${lang}/create/done`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedCreateDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ slug?: string }>;
}) {
  const [{ locale }, { slug }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale) || !slug) notFound();

  const doneHref = localizeHref(locale, `/create/done?slug=${encodeURIComponent(slug)}`);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(localizeHref(locale, `/login?redirect=${encodeURIComponent(doneHref)}`));
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('slug, title, status')
    .eq('slug', slug)
    .eq('creator_id', user.id)
    .maybeSingle();

  if (!quiz) notFound();

  const es = locale === 'es';
  const published = quiz.status === 'published';
  const copy = es
    ? {
        eyebrow: 'Estudio',
        pendingTitle: 'En revisión',
        pendingBody:
          ' ya está en QuizVerse. El equipo revisa los quizzes nuevos antes de publicarlos: cuando quede aprobado aparecerá en el catálogo.',
        publishedTitle: 'Publicado',
        publishedBody: ' ya está en línea y cualquiera puede jugarlo.',
        viewQuiz: 'Ver el quiz',
        myQuizzes: 'Mis quizzes',
        home: 'Volver al inicio',
      }
    : {
        eyebrow: 'Studio',
        pendingTitle: 'In review',
        pendingBody:
          ' is in QuizVerse. The team reviews new quizzes before publishing them: once approved it will show up in the catalogue.',
        publishedTitle: 'Published',
        publishedBody: ' is live and anyone can play it.',
        viewQuiz: 'View the quiz',
        myQuizzes: 'My quizzes',
        home: 'Back to home',
      };

  return (
    <div className="mx-auto max-w-3xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-12">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          {published ? copy.publishedTitle : copy.pendingTitle}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          <span className="text-text-primary font-semibold">«{quiz.title}»</span>
          {published ? copy.publishedBody : copy.pendingBody}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {published ? (
            <Link
              href={localizeHref(locale, `/quiz/${quiz.slug}`)}
              className="bg-accent-primary rounded-full px-5 py-3 text-sm font-semibold text-white"
            >
              {copy.viewQuiz}
            </Link>
          ) : null}
          <Link
            href={localizeHref(locale, '/my-quizzes')}
            className={
              published
                ? 'ring-border-subtle text-text-primary rounded-full px-5 py-3 text-sm font-semibold ring-1'
                : 'bg-accent-primary rounded-full px-5 py-3 text-sm font-semibold text-white'
            }
          >
            {copy.myQuizzes}
          </Link>
          <Link
            href={localizeHref(locale, '/')}
            className="ring-border-subtle text-text-primary rounded-full px-5 py-3 text-sm font-semibold ring-1"
          >
            {copy.home}
          </Link>
        </div>
      </section>
    </div>
  );
}
