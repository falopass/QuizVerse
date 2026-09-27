import type { Metadata } from 'next';
import { Archivo_Black, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SupabaseProvider } from '@/providers/supabase-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { ToastViewport } from '@/components/ui/toast';
import { AppTelemetry } from '@/components/layout/app-telemetry';
import { CookieConsentBanner } from '@/components/shared/cookie-consent';

const archivo = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo',
  display: 'swap',
});

const space = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'QuizVerse | Editorial quizzes with personality',
    template: '%s | QuizVerse',
  },
  description:
    'Play personality quizzes, sharp trivia and fast editorial formats with a stronger product experience.',
  keywords: ['quizzes', 'personality tests', 'trivia', 'editorial entertainment'],
  authors: [{ name: 'QuizVerse' }],
  creator: 'QuizVerse',
  alternates: {
    canonical: siteUrl,
    languages: {
      en: `${siteUrl}/en`,
      es: `${siteUrl}/es`,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'QuizVerse',
    title: 'QuizVerse | Editorial quizzes with personality',
    description: 'Play bold quizzes, create your own, and share results worth showing.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'QuizVerse',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuizVerse | Editorial quizzes with personality',
    description: 'Play bold quizzes, create your own, and share results worth showing.',
    images: ['/opengraph-image'],
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
  icons: {
    icon: '/quizverse-favicon.png',
    apple: '/quizverse-favicon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`h-full ${archivo.variable} ${space.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="preconnect" href="https://supabase.co" crossOrigin="anonymous" />
      </head>
      <body className="editorial-shell bg-bg-primary text-text-primary h-full antialiased">
        <SupabaseProvider>
          <ThemeProvider>
            <ToastProvider>
              <AppTelemetry />
              {children}
              <ToastViewport />
              <CookieConsentBanner />
              <Analytics />
              <SpeedInsights />
            </ToastProvider>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
