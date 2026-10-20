import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Replaces the old static public/robots.txt.
 *
 * Everything public is crawlable; only the JSON API is closed. Pages that must
 * not be indexed (login, signup, /play, /result, profiles) are deliberately left
 * crawlable and opt out with a `noindex` meta tag: a Disallow rule would stop
 * Google from ever seeing that noindex.
 *
 * `/api/og/` stays open: the shared result cards live under `/api/og/result/…`
 * and crawlers that honor robots.txt (Google, Bing, Facebook, X) must fetch
 * them or shared links render without an image. Under Google's longest-match
 * rule the more specific `allow` wins over the `/api/` disallow.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/'],
        disallow: '/api/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
