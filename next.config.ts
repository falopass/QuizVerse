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

/**
 * Ningún despliegue que no sea producción debe entrar en el índice.
 *
 * Vercel publica cada rama y cada PR en una URL propia. Sin esta cabecera,
 * Google acaba indexando `quizverse-git-rama-equipo.vercel.app` y compite
 * contra `quizverse.org` por las mismas consultas: contenido duplicado servido
 * por el propio producto. Los previews del VPS ya lo hacen en Caddy; esto cubre
 * el otro camino.
 */
const IS_PREVIEW_DEPLOY = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV !== 'production'
  : process.env.NODE_ENV === 'development';

/**
 * Un build de Vercel produce un artefacto desplegable: nunca puede salir con
 * placeholders de Supabase congelados en el bundle del navegador. Si faltan
 * las envs, el build (y por tanto el deploy) falla aquí, antes de empaquetar.
 * GitHub Actions y las máquinas de desarrollo no definen `VERCEL`, así que sus
 * builds de verificación siguen pasando sin variables.
 */
if (process.env.VERCEL) {
  const missingSupabaseEnv = [
    ...(!process.env.NEXT_PUBLIC_SUPABASE_URL ? ['NEXT_PUBLIC_SUPABASE_URL'] : []),
    ...(!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY']
      : []),
  ];
  if (missingSupabaseEnv.length > 0) {
    throw new Error(
      `Missing required Supabase environment variables: ${missingSupabaseEnv.join(', ')}`
    );
  }
}

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
      // Va al final a propósito: si otra regla toca la misma cabecera, esta gana.
      ...(!IS_PREVIEW_DEPLOY
        ? []
        : [
            {
              source: '/(.*)',
              headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
            },
          ]),
    ];
  },

  async redirects() {
    return [];
  },

  async rewrites() {
    return [
      // Public sitemap URL → the route handler that can query Supabase.
      // (The Google verification file is answered directly in proxy.ts, before
      // the locale redirect, so it needs no rewrite.)
      { source: '/sitemap.xml', destination: '/api/sitemap' },
    ];
  },
};

export default nextConfig;
