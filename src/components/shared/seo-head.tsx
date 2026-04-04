import type { Metadata } from 'next';

interface SeoHeadProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
}

export function generateMetadata({
  title,
  description,
  image = '/opengraph-image',
  url = 'https://quizverse.org',
  type = 'website',
  publishedTime,
}: SeoHeadProps): Metadata {
  const siteName = 'QuizVerse';
  const locale = 'en_US';

  return {
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    openGraph: {
      type,
      locale,
      url,
      siteName,
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      publishedTime,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
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

export function SeoHead({ title, description }: SeoHeadProps) {
  return null; // This is just for metadata generation
}

export default SeoHead;
