import type { Metadata } from 'next';
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
    title: es ? 'Crear un quiz con AI' : 'Create a quiz with AI',
    description: es
      ? 'Genera un borrador de quiz con AI y edítalo hasta publicarlo en QuizVerse.'
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

  return (
    <div className="mx-auto max-w-5xl px-4 pt-28 pb-20">
      <div className="mb-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-panel p-8">
          <p className="eyebrow">{locale === 'es' ? 'Estudio AI' : 'AI Studio'}</p>
          <h1 className="text-text-primary mt-4 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
            {dictionary.create.aiTitle}
          </h1>
          <p className="balanced-copy text-text-secondary mt-4 max-w-xl text-lg">
            {dictionary.create.aiSubtitle}
          </p>
        </div>
      </div>
      <AIQuizGenerator locale={locale} />
    </div>
  );
}
