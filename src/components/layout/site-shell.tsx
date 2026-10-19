'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { FloatingNav } from './floating-nav';
import { Footer } from './footer';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

interface SiteShellProps {
  children: React.ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}

const FULLSCREEN_PATTERNS = [
  /^\/(?:en|es)\/quiz\/[^/]+\/play$/,
  /^\/(?:en|es)\/quiz\/[^/]+\/result$/,
];

export function SiteShell({ children, locale, dictionary }: SiteShellProps) {
  const pathname = usePathname();
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const isFullscreen = FULLSCREEN_PATTERNS.some((pattern) => pattern.test(pathname));

  return (
    <>
      <a
        href="#main-content"
        className="focus:border-border focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
      >
        {locale === 'es' ? 'Saltar al contenido' : 'Skip to content'}
      </a>
      {!isFullscreen && <FloatingNav locale={locale} dictionary={dictionary} />}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {!isFullscreen && <Footer dictionary={dictionary} locale={locale} />}
    </>
  );
}
