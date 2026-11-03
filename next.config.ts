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
 * Workers Builds publica cada rama de PR en una preview propia. Sin esta
 * cabecera, Google acabaría indexando la preview y compitiendo contra
 * `quizverse.org` por las mismas consultas: contenido duplicado servido por
 * el propio producto.
 */
const IS_PREVIEW_DEPLOY =
  process.env.WORKERS_CI_BRANCH !== undefined && process.env.WORKERS_CI_BRANCH !== 'main';

/**
 * Un build desplegable (Workers Builds; `VERCEL` queda como guardarraíl) nunca
 * puede salir con placeholders de Supabase congelados en el bundle del
 * navegador. Si faltan las envs, el build (y por tanto el deploy) falla aquí,
 * antes de empaquetar. GitHub Actions y las máquinas de desarrollo no definen
 * esas variables, así que sus builds de verificación siguen pasando sin ellas.
 */
if (process.env.VERCEL || process.env.WORKERS_CI) {
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

/** Security headers shared by every route; the embed blocks omit X-Frame-Options. */
const SECURITY_HEADERS = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Grupo de la Reporting API para el `report-to` de la CSP: sin esta
  // cabecera, los navegadores solo usarían el legado `report-uri`
  // (application/csp-report) y jamás el formato application/reports+json.
  { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
];

/**
 * Origen real de Supabase para `connect-src`, leído de la config pública
 * (`NEXT_PUBLIC_SUPABASE_URL`). Si el build corre sin envs (CI de solo
 * verificación), se cae al wildcard de `images.remotePatterns`.
 */
function supabaseConnectSrc(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'https://*.supabase.co';
  try {
    return new URL(url).origin;
  } catch {
    return 'https://*.supabase.co';
  }
}

/**
 * Content-Security-Policy en modo *report-only*: se emite como
 * `Content-Security-Policy-Report-Only`, así que el navegador solo informa
 * violaciones en consola sin bloquear nada. Sirve para medir el ruido real
 * antes de endurecerla.
 *
 * Las violaciones se informan a `report-uri /api/csp-report`, que acepta los
 * formatos `application/csp-report` y `application/reports+json` con tope de
 * tamaño y rate limit, y registra un resumen sin datos personales.
 *
 * Para pasarla a enforce: cambiar el `key` a `Content-Security-Policy`,
 * desplegar y vigilar una temporada los reportes resumidos que emite ese
 * endpoint.
 *
 * AdSense: si `ADSENSE_PUBLISHER_ID` o `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` están
 * definidos en el build se añaden sus orígenes (script, img, frame y connect).
 * Sin publisher la CSP queda igual y los slots ni siquiera se renderizan.
 *
 * `frameAncestors`: `"'none'"` reproduce el X-Frame-Options: DENY de las rutas
 * normales; las rutas `/embed/{en,es}/*` lo omiten para seguir siendo
 * embebibles desde cualquier origen.
 */
function contentSecurityPolicy(frameAncestors: string | null): string {
  const ads = Boolean(
    (process.env.ADSENSE_PUBLISHER_ID || process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID)?.trim()
  );
  return [
    "default-src 'self'",
    // Next.js serializa el payload RSC con <script> inline; sin un nonce por
    // request (middleware) no hay alternativa a 'unsafe-inline' aquí.
    `script-src 'self' 'unsafe-inline'${ads ? ' https://pagead2.googlesyndication.com' : ''}`,
    // Tailwind y los estilos en línea de Framer Motion los necesitan.
    "style-src 'self' 'unsafe-inline'",
    // Mismos hosts que images.remotePatterns; las covers stock se sirven
    // same-origin vía /stock-covers/ y las procedurales vía /covers/.
    `img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://images.pexels.com https://pixabay.com${ads ? ' https://*.googlesyndication.com' : ''}`,
    // next/font auto-aloja las fuentes en build.
    "font-src 'self'",
    `connect-src 'self' ${supabaseConnectSrc()}${ads ? ' https://*.googlesyndication.com https://*.doubleclick.net' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(ads
      ? ['frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com']
      : []),
    ...(frameAncestors ? [`frame-ancestors ${frameAncestors}`] : []),
    'report-uri /api/csp-report',
    'report-to csp',
  ].join('; ');
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  htmlLimitedBots: CRAWLER_USER_AGENTS,

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
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
        // DENY stays everywhere except real embed player paths
        // (/embed/{en|es}/<slug>): those must render inside iframes. Other
        // /embed/* URLs — the shared 404 included — keep frame protection.
        source: '/((?!embed/en/|embed/es/).*)',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy("'none'"),
          },
        ],
      },
      {
        source: '/embed/en/:path*',
        headers: [
          ...SECURITY_HEADERS,
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy(null),
          },
        ],
      },
      {
        source: '/embed/es/:path*',
        headers: [
          ...SECURITY_HEADERS,
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy(null),
          },
        ],
      },
      // Las reglas de caché de los assets de marca (/icons, /og, /favicon.ico)
      // viven en public/_headers: en Cloudflare Workers la capa de assets sirve
      // public/ sin pasar por el Worker, así que headers() nunca las alcanza.
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
    // URLs antiguas de explorar: el catálogo vive en /{locale}/quiz.
    return [
      { source: '/en/explore', destination: '/en/quiz', permanent: true },
      { source: '/es/explore', destination: '/es/quiz', permanent: true },
      // El feed sin locale: el matcher del proxy excluye *.xml, así que
      // /feed.xml nunca llega al redirect de idioma; se consolida aquí en el
      // feed en inglés (los lectores conocen la URL raíz).
      { source: '/feed.xml', destination: '/en/feed.xml', permanent: true },
    ];
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
