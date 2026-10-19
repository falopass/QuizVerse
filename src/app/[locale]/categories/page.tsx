import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildCategoryHub,
  categoryHubCopy,
  type CategoryHubItem,
} from '@/lib/content/category-hub';
import { getCategoryCounts, getTypeCounts } from '@/lib/data/category-counts';
import { getPublicCategories } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbNode,
  buildGraph,
  itemListNode,
  webPageNode,
} from '@/lib/seo/structured-data';

type CategoriesProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CategoriesProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const copy = categoryHubCopy(locale);
  return buildMetadata({
    title: copy.metaTitle,
    description: copy.metaDescription,
    path: `/${locale}/categories`,
    alternatePath: `/${locale === 'es' ? 'en' : 'es'}/categories`,
    locale,
  });
}

function HubCard({
  item,
  tag,
  quizLabel,
  cta,
}: {
  item: CategoryHubItem;
  tag: string;
  quizLabel: string;
  cta: string;
}) {
  return (
    <Link href={item.href} className="arcade-card h-auto!">
      <div className="arcade-card-info">
        <span className="arcade-tag">{tag}</span>
        <h3>{item.name}</h3>
        {item.description ? (
          <p className="text-text-secondary line-clamp-3 text-sm leading-snug">
            {item.description}
          </p>
        ) : null}
        <div className="arcade-card-bottom">
          <small>
            {item.count} {quizLabel}
          </small>
          <span className="arcade-card-play">{cta} ↗</span>
        </div>
      </div>
    </Link>
  );
}

export default async function LocalizedCategoriesPage({ params }: CategoriesProps) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const [categories, counts, typeCounts, dictionary] = await Promise.all([
    getPublicCategories(),
    getCategoryCounts(locale),
    getTypeCounts(locale),
    getDictionary(locale),
  ]);

  const copy = categoryHubCopy(locale);
  const items = buildCategoryHub(categories, counts, typeCounts, locale);
  const categoryItems = items.filter((item) => item.kind === 'category');
  const typeItems = items.filter((item) => item.kind === 'type');
  const totalQuizzes = categoryItems.reduce((total, item) => total + item.count, 0);
  const path = `/${locale}/categories`;
  const homeLabel = locale === 'es' ? 'Inicio' : 'Home';

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <JsonLd
        data={buildGraph([
          webPageNode(path, locale, copy.title),
          breadcrumbNode([
            { name: homeLabel, path: `/${locale}` },
            { name: dictionary.common.explore, path: `/${locale}/quiz` },
            { name: copy.title, path },
          ]),
          itemListNode(
            items.map((item) => ({ name: item.name, path: item.href })),
            locale,
            copy.title
          ),
        ])}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { name: homeLabel, href: `/${locale}` },
          { name: dictionary.common.explore, href: `/${locale}/quiz` },
          { name: copy.title },
        ]}
      />
      <section className="arcade-category-hero">
        <span className="arcade-live">
          {copy.eyebrow} / {copy.title}
        </span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <strong>
          {totalQuizzes} {copy.quizLabel}
        </strong>
      </section>
      <div className="arcade-section-head">
        <h2>{copy.sectionCategories}</h2>
      </div>
      <div className="arcade-grid">
        {categoryItems.map((item) => (
          <HubCard
            key={item.slug}
            item={item}
            tag={dictionary.arcade.category}
            quizLabel={copy.quizLabel}
            cta={dictionary.arcade.play}
          />
        ))}
      </div>
      <section className="arcade-related" aria-labelledby="type-hubs">
        <div className="arcade-section-head">
          <h2 id="type-hubs">{copy.sectionTypes}</h2>
        </div>
        <div className="arcade-grid">
          {typeItems.map((item) => (
            <HubCard
              key={item.slug}
              item={item}
              tag={dictionary.arcade.gameType}
              quizLabel={copy.quizLabel}
              cta={dictionary.arcade.play}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
