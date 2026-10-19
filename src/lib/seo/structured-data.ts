import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category, Quiz } from '@/types/quiz';
import { getLocalizedDifficultyLabel, getLocalizedTypeLabel } from '@/lib/i18n/catalog';
import { BRAND_LOGO, SITE_NAME, SITE_URL, absoluteUrl, safePath } from './site';

export type JsonLdNode = Record<string, unknown>;

export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
}

/** Wraps nodes into a single valid graph. One block per page, by design. */
export function buildGraph(nodes: Array<JsonLdNode | null | undefined>): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter((node): node is JsonLdNode => Boolean(node)),
  };
}

export function organizationNode(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: BRAND_LOGO,
      contentUrl: BRAND_LOGO,
      width: 512,
      height: 512,
      caption: SITE_NAME,
    },
    image: { '@id': `${SITE_URL}/#logo` },
  };
}

export function websiteNode(locale: Locale): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: locale === 'es' ? 'es' : 'en',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbNode(items: BreadcrumbItem[]): JsonLdNode | null {
  if (items.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListNode(
  items: Array<{ name: string; path: string }>,
  locale: Locale,
  name?: string
): JsonLdNode | null {
  if (items.length === 0) return null;
  return {
    '@type': 'ItemList',
    name: name ?? (locale === 'es' ? 'Quizzes de QuizVerse' : 'QuizVerse quizzes'),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function categoryPath(locale: Locale, slug: string): string {
  return `/${locale}/category/${safePath(slug)}`;
}

export function quizPath(locale: Locale, slug: string): string {
  return `/${locale}/quiz/${safePath(slug)}`;
}

/** ISO-8601 duration, e.g. 4 minutes → `PT4M`. */
export function isoDuration(minutes: number): string {
  const safe = Math.max(1, Math.round(minutes || 1));
  return `PT${safe}M`;
}

export interface QuizSchemaOptions {
  quiz: Quiz;
  locale: Locale;
  category: Category | null;
  description: string;
  imageUrl: string;
}

export function quizNode({
  quiz,
  locale,
  category,
  description,
  imageUrl,
}: QuizSchemaOptions): JsonLdNode {
  const url = absoluteUrl(quizPath(locale, quiz.slug));

  return {
    '@type': 'Quiz',
    '@id': `${url}#quiz`,
    url,
    name: quiz.title,
    description,
    inLanguage: quiz.language === 'es' ? 'es' : 'en',
    isAccessibleForFree: true,
    numberOfQuestions: quiz.questions.length || undefined,
    timeRequired: isoDuration(quiz.estimated_minutes),
    educationalLevel: getLocalizedDifficultyLabel(quiz.difficulty, locale),
    learningResourceType: getLocalizedTypeLabel(quiz.quiz_type, locale),
    ...(category ? { about: { '@type': 'Thing', name: category.name } } : {}),
    ...(quiz.tags.length > 0 ? { keywords: quiz.tags.slice(0, 8).join(', ') } : {}),
    image: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: 1200,
      height: 630,
    },
    ...(quiz.published_at ? { datePublished: quiz.published_at } : {}),
    ...(quiz.published_at ? { dateModified: quiz.published_at } : {}),
    ...(quiz.plays_count > 0
      ? {
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/PlayAction',
            userInteractionCount: quiz.plays_count,
          },
        }
      : {}),
    publisher: { '@id': `${SITE_URL}/#organization` },
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
}

export function webPageNode(path: string, locale: Locale, name: string): JsonLdNode {
  return {
    '@type': 'WebPage',
    '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    inLanguage: locale === 'es' ? 'es' : 'en',
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
}
