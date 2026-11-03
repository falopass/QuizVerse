import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Space_Grotesk } from 'next/font/google';
import '@/app/globals.css';
import { SupabaseProvider } from '@/providers/supabase-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { ToastViewport } from '@/components/ui/toast';
import { AppTelemetry } from '@/components/layout/app-telemetry';
import { WebVitals } from '@/components/layout/web-vitals';
import { CookieConsentBanner } from '@/components/shared/cookie-consent';
import { JsonLd } from '@/components/seo/json-ld';
import { buildGraph, organizationNode, websiteNode } from '@/lib/seo/structured-data';
import type { Locale } from '@/lib/i18n/dictionaries';
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  GOOGLE_SITE_VERIFICATION,
  OTHER_VERIFICATIONS,
  SITE_NAME,
  SITE_URL,
} from '@/lib/seo/site';

// Archivo Black pinta el elemento LCP (título del hero, h1 de ficha). `optional`
// lo saca del camino crítico del LCP: si no llega dentro del bloqueo (~100 ms)
// el texto queda con el fallback de métricas ajustadas en vez de repintar tarde
// (medido con CDP en Slow 4G: el swap solo cuesta ~280 ms de LCP). Sigue
// precargada, así que conexiones normales y navegaciones siguientes sí la usan.
// `latin` ya cubre todo el conjunto en/es (ñ, tildes, ¿, ¡); latin-ext sobra.
const archivo = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo',
  display: 'optional',
});

// El texto nunca es el elemento LCP: `swap` garantiza que acaba pintando en
// Space Grotesk, y quitarle el preload deja ~10 KB de ancho de banda para la
// fuente display y la portada en la primera carga.
const space = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
  preload: false,
});

const SITE_DESCRIPTION =
  'Play pop culture quizzes, personality tests and sharp trivia in English and Spanish. Pick a game, get your result and share it.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} — Personality quizzes & trivia in English and Spanish`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'quizzes',
    'trivia',
    'personality tests',
    'pop culture quizzes',
    'fandom quizzes',
    'quiz games',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'entertainment',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    alternateLocale: ['es_ES'],
    url: SITE_URL,
    title: `${SITE_NAME} — Personality quizzes & trivia`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_IMAGE_WIDTH,
        height: DEFAULT_OG_IMAGE_HEIGHT,
        alt: SITE_NAME,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Personality quizzes & trivia`,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  // `robots` is deliberately NOT set here. Every page declares its own value via
  // buildMetadata(); leaving it out lets Next's default `noindex` apply to the
  // not-found page. With a layout-level `index, follow`, 404s came back as
  // soft 404s (HTTP 200 + "index, follow") because the auth/loading boundary has
  // already streamed the status by the time notFound() is thrown.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black',
  },
  formatDetection: { telephone: false, address: false, email: false },
  verification: {
    ...(GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : {}),
    ...(Object.keys(OTHER_VERIFICATIONS).length > 0 ? { other: OTHER_VERIFICATIONS } : {}),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: '#101019',
};

/** Documento compartido por los layouts raíz; nunca lee datos de la petición. */
export function SiteDocument({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return (
    <html
      lang={locale}
      className={`h-full ${archivo.variable} ${space.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="bg-bg-primary text-text-primary h-full antialiased">
        <JsonLd data={buildGraph([organizationNode(), websiteNode(locale)])} />
        <SupabaseProvider>
          <ThemeProvider>
            <ToastProvider>
              <AppTelemetry />
              <WebVitals />
              {children}
              <ToastViewport />
              <CookieConsentBanner />
            </ToastProvider>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
