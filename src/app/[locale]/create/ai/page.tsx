import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AIQuizGenerator } from '@/components/quiz/ai-quiz-generator';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';

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
    redirect(localizeHref(locale, `/login?redirect=${encodeURIComponent(localizeHref(locale, '/create/ai'))}`));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-28">
      <div className="mb-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-panel p-8">
          <p className="eyebrow">{locale === 'es' ? 'Estudio AI' : 'AI Studio'}</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-text-primary md:text-6xl">{dictionary.create.aiTitle}</h1>
          <p className="balanced-copy mt-4 max-w-xl text-lg text-text-secondary">{dictionary.create.aiSubtitle}</p>
        </div>
      </div>
      <AIQuizGenerator locale={locale} />
    </div>
  );
}
