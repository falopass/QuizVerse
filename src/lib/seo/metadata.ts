import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/dictionaries';
import { quizCountLabel } from '@/lib/i18n/counts';
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ES,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  SITE_NAME,
  TWITTER_HANDLE,
  absoluteUrl,
} from './site';

const OG_LOCALE: Record<Locale, string> = { en: 'en_US', es: 'es_ES' };

/** Google truncates titles around 60 characters; the template suffix is 12. */
const SERP_TITLE_MAX = 60;
const TITLE_SUFFIX = ` | ${SITE_NAME}`;

/**
 * Keeps the `| QuizVerse` template suffix only when the full title still fits
 * in the SERP. Long titles drop the suffix instead of losing their tail; the
 * title itself is never truncated.
 */
export function resolveTitle(title: string, absoluteTitle: boolean): string | { absolute: string } {
  if (absoluteTitle || title.length + TITLE_SUFFIX.length > SERP_TITLE_MAX) {
    return { absolute: title };
  }
  return title;
}

/** Google truncates around 155–160 characters. Keep descriptions honest and short. */
const DESCRIPTION_MAX = 158;

/**
 * Collapses whitespace/markdown noise and clamps a description to a length that
 * is not truncated in the SERP. Cuts on a word boundary so it never ends mid-word.
 */
export function clampDescription(input: string | null | undefined, max = DESCRIPTION_MAX): string {
  const text = (input ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`>#]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= max) return text;

  const slice = text.slice(0, max - 1);
  const cut = slice.lastIndexOf(' ');
  const body = cut > max * 0.6 ? slice.slice(0, cut) : slice;
  return `${body.replace(/[,;:.\s]+$/, '')}…`;
}

export function localizedPath(locale: Locale, path: string): string {
  const normalized = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

function otherLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}

export interface BuildMetadataOptions {
  /** Page title without the `| QuizVerse` suffix. */
  title: string;
  /** Skip the site suffix (for the home page, where the title is already complete). */
  absoluteTitle?: boolean;
  description?: string | null;
  /** Locale-prefixed path, e.g. `/en/quiz/my-quiz`. */
  path: string;
  locale: Locale;
  /**
   * Locale-prefixed path of the translated counterpart, only when that page
   * actually exists. Never pass a fallback such as the locale home page:
   * a wrong hreflang is worse than none.
   */
  alternatePath?: string | null;
  /** Absolute image URL. Defaults to the static 1200×630 brand card. */
  image?: string | null;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: 'website' | 'article';
  /** Drop the page from the index (auth, share tokens, user-generated profiles). */
  noindex?: boolean;
  /** Keep following links when the page itself is not indexable. */
  follow?: boolean;
  keywords?: string[];
  publishedTime?: string | null;
  modifiedTime?: string | null;
}

/**
 * Builds one complete, self-consistent metadata object: title, description,
 * canonical, hreflang (+ x-default), Open Graph and Twitter all derive from the
 * same canonical URL, so they can never point at different pages.
 */
export function buildMetadata({
  title,
  absoluteTitle = false,
  description,
  path,
  locale,
  alternatePath,
  image,
  imageAlt,
  imageWidth = DEFAULT_OG_IMAGE_WIDTH,
  imageHeight = DEFAULT_OG_IMAGE_HEIGHT,
  type = 'website',
  noindex = false,
  follow = true,
  keywords,
  publishedTime,
  modifiedTime,
}: BuildMetadataOptions): Metadata {
  const canonical = absoluteUrl(path);
  const resolvedDescription =
    clampDescription(description) ||
    (locale === 'es'
      ? 'Quizzes de cultura pop, trivia y personalidad para jugar y compartir en QuizVerse.'
      : 'Pop culture quizzes, trivia and personality games to play and share on QuizVerse.');

  const languages: Record<string, string> = { [locale]: canonical };
  let xDefault = canonical;

  if (alternatePath) {
    const alternate = absoluteUrl(alternatePath);
    languages[otherLocale(locale)] = alternate;
    xDefault = locale === 'en' ? canonical : alternate;
  }
  languages['x-default'] = xDefault;

  const ogImage = image ?? (locale === 'es' ? DEFAULT_OG_IMAGE_ES : DEFAULT_OG_IMAGE);
  return {
    title: resolveTitle(title, absoluteTitle),
    description: resolvedDescription,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: {
      canonical,
      languages,
      types: { 'application/atom+xml': absoluteUrl(`/${locale}/feed.xml`) },
    },
    openGraph: {
      type,
      url: canonical,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: [OG_LOCALE[otherLocale(locale)]],
      title,
      description: resolvedDescription,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      images: [
        {
          url: ogImage,
          width: imageWidth,
          height: imageHeight,
          alt: imageAlt ?? title,
          type: ogImage.endsWith('.png') ? 'image/png' : undefined,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: resolvedDescription,
      images: [ogImage],
      ...(TWITTER_HANDLE ? { site: TWITTER_HANDLE, creator: TWITTER_HANDLE } : {}),
    },
    robots: noindex
      ? { index: false, follow, googleBot: { index: false, follow } }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  };
}

export interface GenerateCategoryMetadataOptions {
  name: string;
  slug: string;
  description?: string | null;
  image?: string;
  locale?: Locale;
  quizCount?: number;
  /**
   * Whether `/{otherLocale}/category/{slug}` actually renders, i.e. the hub has
   * at least one published quiz in that locale. Without it the page is a 404
   * (`notFound()`), so no hreflang may be emitted — a 404 alternate is worse
   * than none.
   */
  translatedHubExists?: boolean;
}

export function generateCategoryMetadata({
  name,
  slug,
  description,
  image,
  locale = 'en',
  quizCount,
  translatedHubExists = false,
}: GenerateCategoryMetadataOptions): Metadata {
  const title = quizCount
    ? locale === 'es'
      ? `${name}: ${quizCountLabel(quizCount)} online`
      : `${name}: ${quizCountLabel(quizCount)} to play`
    : locale === 'es'
      ? `Quizzes de ${name}`
      : `${name} quizzes`;

  return buildMetadata({
    title,
    description,
    path: localizedPath(locale, `/category/${slug}`),
    alternatePath: translatedHubExists
      ? localizedPath(locale === 'es' ? 'en' : 'es', `/category/${slug}`)
      : null,
    locale,
    image,
  });
}

export interface GenerateProfileMetadataOptions {
  username: string;
  displayName?: string;
  bio?: string;
  quizzesCreated?: number;
  locale?: Locale;
}

export function generateProfileMetadata({
  username,
  displayName,
  bio,
  quizzesCreated,
  locale = 'en',
}: GenerateProfileMetadataOptions): Metadata {
  const name = displayName || username;
  const title = locale === 'es' ? `Perfil de ${name}` : `${name}'s profile`;
  const description =
    bio ||
    (locale === 'es'
      ? `${name} ha creado ${quizzesCreated || 0} quizzes en QuizVerse.`
      : `${name} has created ${quizzesCreated || 0} quizzes on QuizVerse.`);

  return buildMetadata({
    title,
    description,
    path: localizedPath(locale, `/profile/${username}`),
    locale,
    // Profiles are user-generated and frequently empty: keep them out of the index.
    noindex: true,
  });
}
