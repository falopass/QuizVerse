import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AIQuizGenerator } from '@/components/quiz/ai-quiz-generator';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';

/** Login-gated tool, not a landing page: anonymous visitors get redirected. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Crear un quiz con IA' : 'Create a quiz with AI',
    description: es
      ? 'Genera un borrador de quiz con IA y edítalo hasta publicarlo en QuizVerse.'
      : 'Generate a quiz draft with AI, then edit it and publish it on QuizVerse.',
    path: `/${lang}/create/ai`,
    locale: lang,
    noindex: true,
  });
}

export default async function LocalizedCreateAIPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const supabase = await createClient();
  const dictionary = await getDictionary(locale);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      localizeHref(
        locale,
        `/login?redirect=${encodeURIComponent(localizeHref(locale, '/create/ai'))}`
      )
    );
  }

  const { data: categories } = await supabase.from('categories').select('*').order('sort_order');
  const es = locale === 'es';

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-20 md:pt-10">
      <div className="mb-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-panel p-8">
          <p className="eyebrow">{es ? 'Estudio de IA' : 'AI Studio'}</p>
          <h1 className="text-text-primary mt-4 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
            {dictionary.create.aiTitle}
          </h1>
          <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
            {dictionary.create.aiSubtitle}
          </p>
        </div>
        <div className="surface-panel flex flex-col justify-between p-8">
          <div>
            <p className="eyebrow">{es ? 'Flujo editorial' : 'Editorial flow'}</p>
            <h2 className="text-text-primary mt-4 text-2xl font-semibold tracking-tight">
              {es
                ? 'Todo borrador nace privado y editable.'
                : 'Every draft starts private and editable.'}
            </h2>
            <p className="balanced-copy text-text-secondary mt-3 text-sm leading-6">
              {es
                ? 'Puedes revisar preguntas, cambiar opciones y ajustar resultados antes de enviarlo a moderación. Si prefieres empezar desde cero, abre el compositor manual.'
                : 'Review questions, edit options and refine outcomes before sending to moderation. If you prefer starting from scratch, open the manual composer.'}
            </p>
          </div>
          <Link
            href={localizeHref(locale, '/create')}
            className="border-border-subtle bg-bg-tertiary text-text-primary hover:border-accent-primary focus-visible:outline-accent-primary mt-6 inline-flex w-fit items-center rounded-full border px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {es ? 'Ir al compositor manual' : 'Open manual composer'}
          </Link>
        </div>
      </div>
      <AIQuizGenerator locale={locale} categories={categories || []} />
    </div>
  );
}
