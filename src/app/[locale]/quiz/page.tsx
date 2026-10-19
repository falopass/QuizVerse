import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExploreEditorialPage } from '@/components/home/explore-editorial-page';
import { JsonLd } from '@/components/seo/json-ld';
import { getExplorePayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildGraph, itemListNode, quizPath, webPageNode } from '@/lib/seo/structured-data';
import { explorerVisibleQuizzes } from '@/lib/quiz/editorial-order';

const EXPLORER_TITLE: Record<Locale, string> = {
  es: 'Explora todos los quizzes — trivia, personalidad y fandom',
  en: 'Explore all quizzes — trivia, personality and fandom',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  return buildMetadata({
    title: EXPLORER_TITLE[locale],
    description:
      locale === 'es'
        ? 'Explora el catálogo completo de QuizVerse por tema, mood y ritmo. Trivia, tests de personalidad y retos de fandom gratis.'
        : 'Browse the full QuizVerse catalog by topic, mood and pace. Free trivia rounds, personality tests and fandom challenges.',
    path: `/${locale}/quiz`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/quiz`,
    locale,
  });
}

export default async function LocalizedQuizExplorerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const payload = await getExplorePayload(locale);

  // This catalogue is a client component, so every object crosses into the RSC
  // payload. Questions and results are the heavy part of a quiz (they were
  // ~1.7 MB of HTML for 259 cards) and the grid never reads them.
  const quizzes = payload.quizzes.map((quiz) => ({ ...quiz, questions: [], results: null }));

  return (
    <>
      <JsonLd
        data={buildGraph([
          webPageNode(`/${locale}/quiz`, locale, EXPLORER_TITLE[locale]),
          itemListNode(
            explorerVisibleQuizzes(payload.quizzes).map((quiz) => ({
              name: quiz.title,
              path: quizPath(locale, quiz.slug),
            })),
            locale
          ),
        ])}
      />
      <ExploreEditorialPage
        locale={locale}
        quizzes={quizzes}
        categories={payload.categories}
        copy={{
          title: dictionary.explore.title,
          subtitle: dictionary.explore.subtitle,
          searchPlaceholder: dictionary.explore.searchPlaceholder,
          emptyTitle: dictionary.explore.emptyTitle,
          emptyBody: dictionary.explore.emptyBody,
          allCategories: dictionary.explore.allCategories,
          eyebrow: locale === 'es' ? 'Explorar' : 'Explore',
          visibleNow: locale === 'es' ? 'Visibles ahora' : 'Visible now',
          playsInView: locale === 'es' ? 'Partidas en vista' : 'Plays in view',
          publishedNow: locale === 'es' ? 'Publicados ahora' : 'Published now',
          searchLabel: locale === 'es' ? 'Buscar' : 'Search',
          categoryLanes: locale === 'es' ? 'Carriles de categoría' : 'Category lanes',
          leadPick: locale === 'es' ? 'Selección principal' : 'Lead pick',
          moreWaysIn: locale === 'es' ? 'Más caminos de entrada' : 'More ways in',
          quizzesAfterFilters: locale === 'es' ? 'quizzes tras filtros' : 'quizzes after filters',
        }}
      />
      <p className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
        <Link
          href={localizeHref(locale, '/indice')}
          className="text-accent-primary underline underline-offset-4"
        >
          {locale === 'es' ? 'Ver el índice completo' : 'See the full index'}
        </Link>
      </p>
    </>
  );
}
