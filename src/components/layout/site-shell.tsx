'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { FloatingNav, extractNavLabels, type NavLabels } from './floating-nav';
import { RouteAnnouncer } from './route-announcer';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

interface SiteShellProps {
  children: React.ReactNode;
  locale: Locale;
  footer?: React.ReactNode;
  navLabels?: NavLabels;
  /** Compatibilidad para tests que aún pasan el diccionario completo. */
  dictionary?: Dictionary;
  categorySlugs?: string[];
}

const FULLSCREEN_PATTERNS = [
  /^\/(?:en|es)\/quiz\/[^/]+\/play$/,
  /^\/(?:en|es)\/quiz\/[^/]+\/result$/,
];

export function SiteShell({ children, locale, footer, navLabels, dictionary }: SiteShellProps) {
  const pathname = usePathname();
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const isFullscreen = FULLSCREEN_PATTERNS.some((pattern) => pattern.test(pathname));
  const resolvedLabels =
    navLabels ?? (dictionary ? extractNavLabels(dictionary, locale) : undefined);

  return (
    <>
      <a
        href="#main-content"
        className="focus:border-bg-primary focus:bg-accent-primary focus:text-bg-primary focus:shadow-card focus:outline-text-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:border-2 focus:px-5 focus:py-2 focus:text-sm focus:font-bold focus:outline-2 focus:outline-offset-2"
      >
        {locale === 'es' ? 'Saltar al contenido' : 'Skip to content'}
      </a>
      {!isFullscreen && resolvedLabels && (
        <FloatingNav locale={locale} navLabels={resolvedLabels} />
      )}
      <React.Suspense fallback={null}>
        <RouteAnnouncer />
      </React.Suspense>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {!isFullscreen && footer}
    </>
  );
}
