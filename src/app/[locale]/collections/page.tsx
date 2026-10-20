import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { COLLECTIONS_INDEX_COPY, collectionPath, getCollections } from '@/lib/content/collections';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbNode, buildGraph, itemListNode, webPageNode } from '@/lib/seo/structured-data';

interface CollectionsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CollectionsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const copy = COLLECTIONS_INDEX_COPY[locale];

  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/collections`,
    // El índice existe en los dos idiomas con la misma ruta: hreflang siempre.
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/collections`,
    locale,
  });
}

export default async function CollectionsIndexPage({ params }: CollectionsPageProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const copy = COLLECTIONS_INDEX_COPY[locale];
  const collections = getCollections();

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <JsonLd
        data={buildGraph([
          webPageNode(`/${locale}/collections`, locale, copy.title),
          breadcrumbNode([
            { name: copy.home, path: `/${locale}` },
            { name: copy.label, path: `/${locale}/collections` },
          ]),
          itemListNode(
            collections.map((collection) => ({
              name: collection.copy[locale].title,
              path: collectionPath(locale, collection),
            })),
            locale,
            copy.title
          ),
        ])}
      />
      <Breadcrumbs
        locale={locale}
        items={[{ name: copy.home, href: `/${locale}` }, { name: copy.label }]}
      />
      <section className="arcade-category-hero">
        <span className="arcade-live">QuizVerse / {copy.label}</span>
        <h1>{copy.heading}</h1>
        <p>{copy.intro}</p>
      </section>
      <nav className="arcade-filters" aria-label={copy.label}>
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={localizeHref(locale, `/collections/${collection.slugs[locale]}`)}
          >
            {collection.copy[locale].title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
