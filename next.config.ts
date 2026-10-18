import type { NextConfig } from 'next';

/**
 * Crawlers that must receive the full `<head>` in the first HTML byte.
 *
 * Next.js streams metadata for dynamic pages, which puts `<title>`, canonical
 * and Open Graph tags in the body. Google and the other crawlers below are
 * added to `htmlLimitedBots` so metadata is resolved *before* the shell is
 * flushed and lands in `<head>`, where every SEO tool expects it.
 */
const CRAWLER_USER_AGENTS =
  /Googlebot|Google-InspectionTool|GoogleOther|AdsBot-Google|Mediapartners-Google|APIs-Google|FeedFetcher-Google|Storebot-Google|Google-?[\w-]+|Chrome-Lighthouse|Bingbot|BingPreview|Slurp|DuckDuckBot|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|redditbot|yandex|baiduspider|sogou|SeznamBot|Yeti|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|bot[\/\s]/i;

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  htmlLimitedBots: CRAWLER_USER_AGENTS,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'pixabay.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Brand assets are content-hashed by nothing, so pin a sane TTL instead
        // of the default no-cache that makes every tab re-download the favicon.
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }],
      },
      {
        source: '/og/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }],
      },
      {
        source: '/favicon.ico',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },

  async redirects() {
    return [];
  },

  async rewrites() {
    return [
      // Public sitemap URL → the route handler that can query Supabase.
      { source: '/sitemap.xml', destination: '/api/sitemap' },
      // Google Search Console HTML-file verification, no rebuild required:
      // https://quizverse.org/google<token>.html returns the expected payload.
      {
        source: '/:file(google[a-zA-Z0-9]{6,}\\.html)',
        destination: '/api/google-verification?file=:file',
      },
    ];
  },
};

export default nextConfig;
