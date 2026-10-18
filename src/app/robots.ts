import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Replaces the old static public/robots.txt.
 *
 * Everything public is crawlable; only the JSON API is closed. Pages that must
 * not be indexed (login, signup, /play, /result, profiles) are deliberately left
 * crawlable and opt out with a `noindex` meta tag: a Disallow rule would stop
 * Google from ever seeing that noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
