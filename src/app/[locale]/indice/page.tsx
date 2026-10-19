import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { buildCatalogIndex, UNCATEGORIZED_GROUP_SLUG } from '@/lib/content/catalog-index';
import { getPublishedQuizzes } from '@/lib/data/public';
import { QUIZ_MAX_ROWS } from '@/lib/data/quiz-pagination';
import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/site';
import {
  breadcrumbNode,
  buildGraph,
  categoryPath,
  itemListNode,
  webPageNode,
} from '@/lib/seo/structured-data';

type IndexCopy = { title: string; description: string; intro: (total: number) => string };

const COPY: Record<Locale, IndexCopy> = {
  es: {
    title: 'Índice del catálogo',
    description:
      'Todos los quizzes de QuizVerse en una sola página: trivia y tests de personalidad agrupados por categoría, gratis y sin registro.',
    intro: (total) =>
      `Aquí está el catálogo completo de QuizVerse: ${total} quizzes de trivia y personalidad agrupados por tema. Elige una categoría o baja directo hasta el quiz que buscas.`,
  },
  en: {
    title: 'Catalog index',
    description:
      'Every QuizVerse quiz on a single page: trivia and personality tests grouped by category, free and with no signup.',
    intro: (total) =>
      `This is the full QuizVerse catalog: ${total} trivia and personality quizzes grouped by theme. Pick a category or scroll straight to the quiz you want.`,
  },
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
  const copy = COPY[locale];

  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/indice`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/indice`,
    locale,
    image: absoluteUrl(`/${locale}/indice/opengraph-image`),
  });
}

export default async function CatalogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const copy = COPY[locale];
  const quizzes = await getPublishedQuizzes(QUIZ_MAX_ROWS, locale);
  const index = buildCatalogIndex(quizzes, locale);
  const path = `/${locale}/indice`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        data={buildGraph([
          webPageNode(path, locale, copy.title),
          breadcrumbNode([
            { name: locale === 'es' ? 'Inicio' : 'Home', path: `/${locale}` },
            { name: copy.title, path },
          ]),
          itemListNode(
            index.hubs.map((hub) => ({
              name: hub.name,
              path: categoryPath(locale, hub.slug),
            })),
            locale
          ),
        ])}
      />
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{copy.title}</h1>
      <p className="text-text-secondary mt-4 max-w-2xl text-lg leading-relaxed">
        {copy.intro(index.total)}
      </p>
      <nav className="arcade-filters mt-8" aria-label={copy.title}>
        {index.hubs.map((hub) => (
          <Link key={hub.slug} href={localizeHref(locale, `/category/${hub.slug}`)}>
            {hub.name} ({hub.count})
          </Link>
        ))}
      </nav>
      {index.groups.map((group) => (
        <section key={group.slug} className="mt-10">
          <h2 className="font-display text-2xl font-semibold">
            {group.slug === UNCATEGORIZED_GROUP_SLUG ? (
              group.name
            ) : (
              <Link
                href={localizeHref(locale, `/category/${group.slug}`)}
                className="hover:text-accent-primary"
              >
                {group.name}
              </Link>
            )}{' '}
            <span className="text-text-secondary text-base font-normal">
              ({group.quizzes.length})
            </span>
          </h2>
          <ul className="mt-4 grid list-none gap-x-8 gap-y-2 pl-0 sm:grid-cols-2 lg:grid-cols-3">
            {group.quizzes.map((quiz) => (
              <li key={quiz.slug}>
                <Link
                  href={localizeHref(locale, `/quiz/${quiz.slug}`)}
                  className="text-text-secondary hover:text-accent-primary"
                >
                  {quiz.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
