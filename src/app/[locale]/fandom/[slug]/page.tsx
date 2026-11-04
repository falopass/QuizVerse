import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { dominantCategory } from '@/lib/content/franchise';
import { getFandomAlternateSlug, getFandomHub, type FandomQuizHub } from '@/lib/data/fandom';
import { localizeCategory } from '@/lib/i18n/catalog';
import { visibleGamesLabel } from '@/lib/i18n/counts';
import { getDictionary, hasLocale, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { formatMessage } from '@/lib/i18n/format';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbNode,
  buildGraph,
  categoryPath,
  itemListNode,
  quizPath,
  webPageNode,
} from '@/lib/seo/structured-data';

// Igual que el resto de páginas públicas (ver #376): ni cookies(), ni
// headers(), ni searchParams — la página queda cacheable al nivel del layout.
export const revalidate = 300;

type FandomProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function fandomPath(locale: Locale, slug: string): string {
  return `/${locale}/fandom/${slug}`;
}

function fandomTitle(dictionary: Dictionary, name: string): string {
  return formatMessage(dictionary.fandom.title, { name });
}

function typesLabel(hub: FandomQuizHub, dictionary: Dictionary): string {
  const types = new Set(hub.quizzes.map((quiz) => quiz.quiz_type));
  if (types.size === 1) {
    if (types.has('trivia')) return dictionary.fandom.typesTrivia;
    if (types.has('personality')) return dictionary.fandom.typesPersonality;
  }
  return dictionary.fandom.typesMixed;
}

/**
 * Párrafo honesto por plantilla: número, tipos de quiz y categoría
 * dominante. También sirve de meta description (buildMetadata la recorta).
 */
function fandomIntro(hub: FandomQuizHub, dictionary: Dictionary, locale: Locale): string {
  const types = typesLabel(hub, dictionary);
  const category = dominantCategory(hub.quizzes);
  if (!category) {
    return formatMessage(dictionary.fandom.introNoCategory, {
      count: hub.quizzes.length,
      name: hub.name,
      types,
    });
  }
  return formatMessage(dictionary.fandom.intro, {
    count: hub.quizzes.length,
    name: hub.name,
    types,
    category: localizeCategory({ id: category.slug, ...category }, locale)?.name ?? category.name,
  });
}

function notFoundMetadata(locale: string): Metadata {
  return { title: locale === 'es' ? 'Página no encontrada' : 'Page not found' };
}

export async function generateMetadata({ params }: FandomProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const [hub, alternateSlug, dictionary] = await Promise.all([
    getFandomHub(locale, slug),
    getFandomAlternateSlug(locale, slug),
    getDictionary(locale),
  ]);
  // El notFound() se lanza en la página, no aquí (ver quiz/[slug]/page.tsx).
  if (!hub) return notFoundMetadata(locale);

  const other: Locale = locale === 'es' ? 'en' : 'es';
  return buildMetadata({
    title: fandomTitle(dictionary, hub.name),
    description: fandomIntro(hub, dictionary, locale),
    path: fandomPath(locale, slug),
    // Solo hay hreflang cuando la misma franquicia tiene hub en el otro idioma.
    alternatePath: alternateSlug ? fandomPath(other, alternateSlug) : null,
    locale,
  });
}

export default async function LocalizedFandomPage({ params }: FandomProps) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const hub = await getFandomHub(locale, slug);
  if (!hub) notFound();

  const dictionary = await getDictionary(locale);
  const quizzes = hub.quizzes.map((quiz) => ({
    ...quiz,
    category: localizeCategory(quiz.category ?? null, locale),
  }));
  const title = fandomTitle(dictionary, hub.name);
  const intro = fandomIntro(hub, dictionary, locale);
  const path = fandomPath(locale, slug);
  const category = dominantCategory(hub.quizzes);
  const categoryName = category
    ? (localizeCategory({ id: category.slug, ...category }, locale)?.name ?? category.name)
    : null;

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <JsonLd
        data={buildGraph([
          webPageNode(path, locale, title),
          breadcrumbNode([
            { name: locale === 'es' ? 'Inicio' : 'Home', path: `/${locale}` },
            { name: dictionary.common.explore, path: `/${locale}/quiz` },
            { name: title, path },
          ]),
          itemListNode(
            quizzes.map((quiz) => ({ name: quiz.title, path: quizPath(locale, quiz.slug) })),
            locale,
            title
          ),
        ])}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { name: locale === 'es' ? 'Inicio' : 'Home', href: `/${locale}` },
          { name: dictionary.common.explore, href: `/${locale}/quiz` },
          { name: title },
        ]}
      />
      <section className="arcade-category-hero">
        <span className="arcade-live">{dictionary.fandom.eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <strong>{visibleGamesLabel(quizzes.length, locale)}</strong>
      </section>
      <div className="arcade-grid">
        {quizzes.map((quiz, index) => (
          <EditorialQuizCard key={quiz.slug} quiz={quiz} locale={locale} index={index} />
        ))}
      </div>
      {category ? (
        <section className="arcade-related">
          <Link
            href={categoryPath(locale, category.slug)}
            className="arcade-back mt-6 inline-block"
          >
            {formatMessage(dictionary.fandom.categoryLink, {
              category: categoryName ?? category.name,
            })}{' '}
            ↗
          </Link>
        </section>
      ) : null}
    </div>
  );
}
