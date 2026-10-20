import { Fragment } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import {
  COLLECTION_PAGE_COPY,
  collectionPath,
  getCollection,
  getCollections,
  pickCollectionQuizzes,
} from '@/lib/content/collections';
import { getPublishedQuizzes } from '@/lib/data/public';
import { getDictionary, hasLocale, locales } from '@/lib/i18n/dictionaries';
import { localizeQuizList } from '@/lib/i18n/catalog';
import { visibleGamesLabel } from '@/lib/i18n/counts';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbNode,
  buildGraph,
  faqNode,
  itemListNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';
import type { Quiz } from '@/types/quiz';

type CollectionPageProps = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return getCollections().flatMap((collection) =>
    locales.map((locale) => ({ locale, slug: collection.slugs[locale] }))
  );
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const collection = getCollection(locale, slug);
  if (!collection) notFound();

  const copy = collection.copy[locale];
  const other = locale === 'es' ? 'en' : 'es';

  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: collectionPath(locale, collection),
    // Cada colección existe en los dos idiomas por construcción: el slug par
    // siempre es una URL real, nunca un 404 anunciado.
    alternatePath: `/${other}/collections/${collection.slugs[other]}`,
    locale,
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const collection = getCollection(locale, slug);
  if (!collection) notFound();

  const copy = collection.copy[locale];
  const labels = COLLECTION_PAGE_COPY[locale];
  const dictionary = await getDictionary(locale);
  const catalog = await getPublishedQuizzes(1000, locale);
  const picked = pickCollectionQuizzes(collection, catalog, locale);
  if (picked.length === 0) notFound();

  // Las tarjetas no leen preguntas ni resultados: se recortan antes de
  // serializar el payload a la página (mismo criterio que /quiz y /category).
  const quizzes: Quiz[] = localizeQuizList(
    picked.map((quiz) => ({ ...quiz, questions: [], results: null })),
    locale
  );
  const path = collectionPath(locale, collection);
  const others = getCollections()
    .filter((item) => item.id !== collection.id)
    .slice(0, 3);

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <JsonLd
        data={buildGraph([
          webPageNode(path, locale, copy.title),
          itemListNode(
            quizzes.map((quiz) => ({ name: quiz.title, path: quizPath(locale, quiz.slug) })),
            locale,
            copy.title
          ),
          breadcrumbNode([
            { name: labels.home, path: `/${locale}` },
            { name: labels.collections, path: `/${locale}/collections` },
            { name: copy.title, path },
          ]),
          faqNode(copy.faq),
        ])}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { name: labels.home, href: `/${locale}` },
          { name: labels.collections, href: `/${locale}/collections` },
          { name: copy.title },
        ]}
      />
      <section className="arcade-category-hero">
        <span className="arcade-live">
          {labels.collections} / {copy.title}
        </span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <strong>{visibleGamesLabel(quizzes.length, locale)}</strong>
      </section>
      <section className="arcade-related">
        {copy.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
      <div className="arcade-section-head">
        <h2>{dictionary.arcade.chooseGame}</h2>
      </div>
      <div className="arcade-grid">
        {quizzes.map((quiz) => (
          <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} />
        ))}
      </div>
      <section className="arcade-related" aria-labelledby="collection-faq">
        <div className="arcade-section-head">
          <h2 id="collection-faq">{labels.faqHeading}</h2>
        </div>
        {copy.faq.map((item) => (
          <Fragment key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </Fragment>
        ))}
      </section>
      <section className="arcade-related" aria-labelledby="other-collections">
        <div className="arcade-section-head">
          <h2 id="other-collections">{labels.otherHeading}</h2>
        </div>
        <nav className="arcade-filters" aria-label={labels.otherHeading}>
          <Link href={localizeHref(locale, '/collections')}>{labels.collections}</Link>
          {others.map((item) => (
            <Link key={item.id} href={localizeHref(locale, `/collections/${item.slugs[locale]}`)}>
              {item.copy[locale].title}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
