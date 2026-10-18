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
      {!isFullscreen && <FloatingNav locale={locale} dictionary={dictionary} />}
      <main id="main-content">{children}</main>
      {!isFullscreen && <Footer dictionary={dictionary} locale={locale} />}
    </>
  );
}
