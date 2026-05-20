import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/dictionaries';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org';

interface GenerateQuizMetadataOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
  locale?: Locale;
  alternateUrl?: string;
}

interface GenerateCategoryMetadataOptions {
  name: string;
  slug: string;
  description: string;
  locale?: Locale;
}

interface GenerateProfileMetadataOptions {
  username: string;
  displayName?: string;
  bio?: string;
  quizzesCreated?: number;
  locale?: Locale;
}

function localizedPath(locale: Locale, path: string) {
  return `${siteUrl}/${locale}${path}`.replace(/([^:]\/)\/+/, '$1');
}

function buildAlternates(locale: Locale, canonicalUrl: string, alternateUrl?: string) {
  const canonicalPath = canonicalUrl.replace(siteUrl, '');
  const alternatePath =
    alternateUrl?.replace(siteUrl, '') ??
    canonicalPath.replace(`/${locale}`, locale === 'es' ? '/en' : '/es');

  return {
    canonical: canonicalUrl,
    languages: {
      [locale]: canonicalUrl,
      [locale === 'es' ? 'en' : 'es']: alternateUrl ?? `${siteUrl}${alternatePath}`,
    },
  } satisfies Metadata['alternates'];
}

export function generateQuizMetadata({
  title,
  description,
  image,
  url,
  locale = 'en',
  alternateUrl,
}: GenerateQuizMetadataOptions): Metadata {
  const siteName = 'QuizVerse';
  const canonicalUrl = url ?? localizedPath(locale, '');
  const socialImage = image ?? `${canonicalUrl.replace(/\/$/, '')}/opengraph-image`;

  return {
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    alternates: buildAlternates(locale, canonicalUrl, alternateUrl),
    openGraph: {
      type: 'website',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      url: canonicalUrl,
      siteName,
      title,
      description,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
      creator: '@quizverse',
    },
    robots: {
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

export function generateCategoryMetadata({
  name,
  slug,
  description,
  locale = 'en',
}: GenerateCategoryMetadataOptions): Metadata {
  const title = locale === 'es' ? `Quizzes de ${name}` : `${name} quizzes`;
  const url = localizedPath(locale, `/category/${slug}`);
  const alternateUrl = localizedPath(locale === 'es' ? 'en' : 'es', `/category/${slug}`);

  return generateQuizMetadata({
    title,
    description,
    locale,
    url,
    alternateUrl,
  });
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
  const url = localizedPath(locale, `/profile/${username}`);
  const alternateUrl = localizedPath(locale === 'es' ? 'en' : 'es', `/profile/${username}`);

  return generateQuizMetadata({
    title,
    description,
    locale,
    url,
    alternateUrl,
  });
}

export default generateQuizMetadata;
