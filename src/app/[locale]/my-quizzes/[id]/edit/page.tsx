import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuizEditForm } from '@/components/quiz/quiz-edit-form';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Private edit screen for the creator's own quizzes: never indexed. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Editar quiz' : 'Edit quiz',
    description: es
      ? 'Corrige el título, la descripción y la categoría de tu quiz.'
      : 'Fix the title, description and category of your quiz.',
    path: `/${lang}/my-quizzes/${id}/edit`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedQuizEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, `/my-quizzes/${id}/edit`))}`
      )
    );
  }

  // Only the editable columns: `questions` carries `is_correct`, which must
  // never cross to the browser (see AGENTS.md, server-authoritative scoring).
  const { data: quiz } = await supabase
    .from('quizzes')
    .select(
      'id, title, description, category_id, quiz_type, difficulty, language, tags, estimated_minutes'
    )
    .eq('id', id)
    .eq('creator_id', user.id)
    .maybeSingle();

  if (!quiz) notFound();

  const { data: categories } = await supabase.from('categories').select('*').order('sort_order');

  const es = locale === 'es';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{es ? 'Estudio' : 'Studio'}</p>
        <h1 className="text-text-primary mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
          {es ? 'Editar quiz' : 'Edit quiz'}
        </h1>
        <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
          {es
            ? `Corrige los datos de «${quiz.title}». Las preguntas no se editan aquí.`
            : `Fix the details of "${quiz.title}". Questions cannot be edited here.`}
        </p>
      </section>
      <QuizEditForm quiz={quiz} categories={categories ?? []} locale={locale} />
    </div>
  );
}
