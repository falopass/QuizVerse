import Link from 'next/link';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getFaq } from '@/lib/i18n/faq';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { buildGraph, webPageNode } from '@/lib/seo/structured-data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  return buildMetadata({
    title: lang === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions',
    description:
      lang === 'es'
        ? 'Respuestas a las preguntas más comunes sobre QuizVerse: cómo jugar, si es gratis, los idiomas disponibles, los puntos y cómo crear tu propio quiz.'
        : 'Answers to the most common questions about QuizVerse: how to play, whether it is free, available languages, points and how to create your own quiz.',
    path: `/${lang}/faq`,
    alternatePath: `/${lang === 'es' ? 'en' : 'es'}/faq`,
    locale: lang,
  });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const items = getFaq(lang);
  const title = lang === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions';

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        data={buildGraph([
          webPageNode(`/${lang}/faq`, lang, title),
          {
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          },
        ])}
      />

      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      <p className="text-text-secondary mt-6 text-lg leading-relaxed">
        {lang === 'es'
          ? 'Lo esencial antes de jugar: qué es QuizVerse, si hace falta cuenta, cómo se puntúa y cómo crear tus propios quizzes.'
          : 'The essentials before you play: what QuizVerse is, whether you need an account, how scoring works and how to create your own quizzes.'}
      </p>

      <div className="mt-12 space-y-10">
        {items.map((item) => (
          <section key={item.question}>
            <h2 className="font-display text-2xl font-semibold">{item.question}</h2>
            <p className="text-text-secondary mt-3 text-base leading-relaxed">{item.answer}</p>
          </section>
        ))}
      </div>

      <div className="border-border-subtle mt-12 border-t pt-8">
        <p className="text-text-secondary text-base leading-relaxed">
          {lang === 'es' ? (
            <>
              ¿Quieres seguir? Recorre el{' '}
              <Link href={localizeHref(lang, '/quiz')} className="text-accent-primary underline">
                catálogo de quizzes
              </Link>
              ,{' '}
              <Link href={localizeHref(lang, '/create')} className="text-accent-primary underline">
                crea tu propio quiz
              </Link>
              , mira quién encabeza el{' '}
              <Link
                href={localizeHref(lang, '/leaderboard')}
                className="text-accent-primary underline"
              >
                ranking
              </Link>{' '}
              o{' '}
              <Link href={localizeHref(lang, '/contact')} className="text-accent-primary underline">
                escríbenos
              </Link>{' '}
              si te queda alguna duda.
            </>
          ) : (
            <>
              Want to keep going? Browse the{' '}
              <Link href={localizeHref(lang, '/quiz')} className="text-accent-primary underline">
                quiz catalog
              </Link>
              ,{' '}
              <Link href={localizeHref(lang, '/create')} className="text-accent-primary underline">
                create your own quiz
              </Link>
              , see who leads the{' '}
              <Link
                href={localizeHref(lang, '/leaderboard')}
                className="text-accent-primary underline"
              >
                leaderboard
              </Link>{' '}
              or{' '}
              <Link href={localizeHref(lang, '/contact')} className="text-accent-primary underline">
                get in touch
              </Link>{' '}
              if you still have questions.
            </>
          )}
        </p>
      </div>
    </main>
  );
}
