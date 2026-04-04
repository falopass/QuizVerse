import type { Metadata } from 'next';
import './globals.css';
import { SupabaseProvider } from '@/providers/supabase-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { ToastViewport } from '@/components/ui/toast';
import { AppTelemetry } from '@/components/layout/app-telemetry';

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
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://supabase.co" crossOrigin="anonymous" />
      </head>
      <body className="editorial-shell h-full bg-bg-primary text-text-primary antialiased">
        <SupabaseProvider>
          <ThemeProvider>
            <ToastProvider>
              <AppTelemetry />
              {children}
              <ToastViewport />
            </ToastProvider>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
