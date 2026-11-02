import { Fragment } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { getHubGuide, getRelatedCategories, RELATED_HEADING } from '@/lib/content/hub-guides';
import {
  getCategoryPayload,
  translatedHubExists,
  translatedHubPageExists,
} from '@/lib/data/public';
import { parsePageParam } from '@/lib/data/quiz-pagination';
import { getDictionary, hasLocale, type Locale } from '@/lib/i18n/dictionaries';
import { localizeCategory, localizeQuizList } from '@/lib/i18n/catalog';
import { categoryDescription, visibleGamesLabel } from '@/lib/i18n/counts';
import { getCategoryGuide } from '@/lib/i18n/category-guides';
import { localizeHref } from '@/lib/i18n/navigation';
import { generateCategoryMetadata } from '@/lib/seo/metadata';
import { categoryOgImage } from '@/lib/seo/site';
import {
  breadcrumbNode,
  buildGraph,
  categoryPath,
  faqNode,
  itemListNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';

type CategoryProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

/** How many quizzes the ItemList advertises. Keeps the JSON-LD payload small. */
const ITEM_LIST_LIMIT = 24;

/** Página 1 sin query (su canonical es la URL limpia); el resto con `?page=N`. */
function categoryPageHref(locale: Locale, slug: string, page: number): string {
  const path = localizeHref(locale, `/category/${slug}`);
  return page > 1 ? `${path}?page=${page}` : path;
}

function notFoundMetadata(locale: string): Metadata {
  return { title: locale === 'es' ? 'Página no encontrada' : 'Page not found' };
}

export async function generateMetadata({ params, searchParams }: CategoryProps): Promise<Metadata> {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) return {};
  const page = parsePageParam(query.page);
  if (page === null) return notFoundMetadata(locale);
  const other = locale === 'es' ? 'en' : 'es';
  const [payload, siblingExists] = await Promise.all([
    getCategoryPayload(slug, locale, page),
    page > 1 ? translatedHubPageExists(slug, other, page) : translatedHubExists(slug, other),
  ]);
  // See quiz/[slug]/page.tsx: notFound() inside generateMetadata streams the
  // 404 client-side only; the page component throws it instead.
  if (!payload || payload.quizzes.length === 0) {
    return notFoundMetadata(locale);
  }
  const category = localizeCategory(payload.category, locale)!;

  // The stored taglines are short ("Sharp rounds with clean pacing."), so the
  // catalog size and the offer are appended to fill the SERP snippet.
  const description = categoryDescription({
    count: payload.totalQuizzes,
    name: category.name,
    tagline: category.description,
    locale,
  });

  return generateCategoryMetadata({
    name: category.name,
    slug,
    description,
    image: categoryOgImage(locale, slug),
    locale,
    quizCount: payload.totalQuizzes,
    translatedHubExists: siblingExists,
    page,
  });
}

export default async function LocalizedCategoryPage({ params, searchParams }: CategoryProps) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();
  const page = parsePageParam(query.page);
  if (page === null) notFound();
  const payload = await getCategoryPayload(slug, locale, page);
  // Fuera de rango la consulta llega vacía: la página no existe, no se sirve
  // una lista vacía con 200.
  if (!payload || payload.quizzes.length === 0) notFound();
  const dictionary = await getDictionary(locale);
  const category = localizeCategory(payload.category, locale)!;
  const quizzes = localizeQuizList(payload.quizzes, locale);
  const guide = getCategoryGuide(
    payload.category.slug,
    locale,
    category.name,
    payload.totalQuizzes
  );
  const path = categoryPath(locale, slug);
  const pagePath = page > 1 ? `${path}?page=${page}` : path;
  const hubGuide = getHubGuide(slug, locale);
  const related = getRelatedCategories(
    slug,
    payload.categories.map((item) => item.slug)
  )
    .map((relatedSlug) => payload.categories.find((item) => item.slug === relatedSlug))
    .filter((item): item is (typeof payload.categories)[number] => Boolean(item));

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <JsonLd
        data={buildGraph([
          webPageNode(pagePath, locale, category.name),
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
          faqNode(guide.faq),
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
        <strong>{visibleGamesLabel(quizzes.length, locale)}</strong>
      </section>
      <nav className="arcade-filters" aria-label={dictionary.arcade.allCategories}>
        <Link prefetch={false} href={localizeHref(locale, '/quiz')}>
          {dictionary.arcade.allCategories}
        </Link>
        {payload.categories.map((item) => {
          const localized = localizeCategory(item, locale)!;
          return (
            <Link
              key={item.id}
              prefetch={false}
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
        {quizzes.map((quiz, index) => (
          <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} index={index} />
        ))}
      </div>
      {payload.pageCount > 1 ? (
        <nav className="arcade-pagination" aria-label={dictionary.arcade.pagination}>
          {page > 1 ? (
            <Link href={categoryPageHref(locale, slug, page - 1)} rel="prev">
              ← {dictionary.arcade.previousPage}
            </Link>
          ) : null}
          <span>
            {dictionary.arcade.page} {page} / {payload.pageCount}
          </span>
          {page < payload.pageCount ? (
            <Link href={categoryPageHref(locale, slug, page + 1)} rel="next">
              {dictionary.arcade.nextPage} →
            </Link>
          ) : null}
        </nav>
      ) : null}
      <section
        className="arcade-related"
        aria-labelledby={hubGuide ? 'category-faq' : 'category-guide'}
      >
        {hubGuide ? null : (
          <>
            <div className="arcade-section-head">
              <h2 id="category-guide">
                {locale === 'es'
                  ? `Cómo son los quizzes de ${category.name}`
                  : `What the ${category.name} quizzes are like`}
              </h2>
            </div>
            {guide.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </>
        )}
        <div className="arcade-section-head">
          <h2 id={hubGuide ? 'category-faq' : undefined}>
            {locale === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions'}
          </h2>
        </div>
        {guide.faq.map((item) => (
          <Fragment key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </Fragment>
        ))}
      </section>
      {hubGuide || related.length >= 2 ? (
        <section
          className="arcade-related"
          aria-labelledby={hubGuide ? 'hub-guide' : 'related-categories'}
        >
          <div className="arcade-section-head">
            <h2 id={hubGuide ? 'hub-guide' : 'related-categories'}>
              {hubGuide ? hubGuide.title : RELATED_HEADING[locale]}
            </h2>
          </div>
          {hubGuide ? (
            <div className="max-w-2xl space-y-4 pb-6">
              {hubGuide.intro.map((paragraph) => (
                <p key={paragraph} className="text-text-secondary leading-7">
                  {paragraph}
                </p>
              ))}
              <ul className="text-text-secondary list-disc space-y-1 pl-5">
                {hubGuide.howTo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-text-secondary leading-7">{hubGuide.closing}</p>
            </div>
          ) : null}
          {related.length > 0 ? (
            <nav className="arcade-filters" aria-label={RELATED_HEADING[locale]}>
              {related.map((item) => {
                const localized = localizeCategory(item, locale)!;
                return (
                  <Link
                    key={item.id}
                    prefetch={false}
                    href={localizeHref(locale, `/category/${item.slug}`)}
                  >
                    {localized.name}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
