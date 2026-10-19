import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { getCategoryPayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeCategory, localizeQuizList } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { generateCategoryMetadata } from '@/lib/seo/metadata';
import { categoryOgImage } from '@/lib/seo/site';
import {
  breadcrumbNode,
  buildGraph,
  categoryPath,
  itemListNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';

type CategoryProps = { params: Promise<{ locale: string; slug: string }> };

/** How many quizzes the ItemList advertises. Keeps the JSON-LD payload small. */
const ITEM_LIST_LIMIT = 24;

export async function generateMetadata({ params }: CategoryProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const payload = await getCategoryPayload(slug, locale);
  if (!payload || payload.quizzes.length === 0) notFound();
  const category = localizeCategory(payload.category, locale)!;
  const count = payload.quizzes.length;
  const tagline = category.description?.trim();

  // The stored taglines are short ("Sharp rounds with clean pacing."), so the
  // catalogue size and the offer are appended to fill the SERP snippet.
  const description =
    locale === 'es'
      ? `${tagline ? `${tagline} ` : ''}${count} quizzes de ${category.name} gratis en QuizVerse, con resultado al instante y sin registro.`
      : `${tagline ? `${tagline} ` : ''}${count} free ${category.name} quizzes on QuizVerse, with instant results and no signup.`;

  return generateCategoryMetadata({
    name: category.name,
    slug,
    description,
    image: categoryOgImage(locale, slug),
    locale,
    quizCount: count,
  });
}

export default async function LocalizedCategoryPage({ params }: CategoryProps) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const payload = await getCategoryPayload(slug, locale);
  if (!payload) notFound();
  if (payload.quizzes.length === 0) notFound();
  const dictionary = await getDictionary(locale);
  const category = localizeCategory(payload.category, locale)!;
  const quizzes = localizeQuizList(payload.quizzes, locale);
  const path = categoryPath(locale, slug);

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <JsonLd
        data={buildGraph([
          webPageNode(path, locale, category.name),
          breadcrumbNode([
            { name: locale === 'es' ? 'Inicio' : 'Home', path: `/${locale}` },
            { name: dictionary.common.explore, path: `/${locale}/quiz` },
            { name: category.name, path },
          ]),
          itemListNode(
            quizzes
              .slice(0, ITEM_LIST_LIMIT)
              .map((quiz) => ({ name: quiz.title, path: quizPath(locale, quiz.slug) })),
            locale
          ),
        ])}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { name: locale === 'es' ? 'Inicio' : 'Home', href: `/${locale}` },
          { name: dictionary.common.explore, href: `/${locale}/quiz` },
          { name: category.name },
        ]}
      />
      <section className="arcade-category-hero">
        <span className="arcade-live">
          {dictionary.arcade.category} / {category.name}
        </span>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
        <strong>
          {quizzes.length} {dictionary.arcade.visibleGames}
        </strong>
      </section>
      <nav className="arcade-filters" aria-label={dictionary.arcade.allCategories}>
        <Link href={localizeHref(locale, '/quiz')}>{dictionary.arcade.allCategories}</Link>
        {payload.categories.map((item) => {
          const localized = localizeCategory(item, locale)!;
          return (
            <Link
              key={item.id}
              href={localizeHref(locale, `/category/${item.slug}`)}
              aria-current={item.slug === slug ? 'page' : undefined}
            >
              {localized.name}
            </Link>
          );
        })}
      </nav>
      <div className="arcade-section-head">
        <h2>{dictionary.arcade.chooseGame}</h2>
        <p>{dictionary.arcade.chooseBody}</p>
      </div>
      <div className="arcade-grid">
        {quizzes.map((quiz) => (
          <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} />
        ))}
      </div>
    </div>
  );
}
