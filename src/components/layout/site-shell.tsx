'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { FloatingNavV2 } from './floating-nav-v2';
import { FooterV2 } from './footer-v2';
import { MobileNavV2 } from './mobile-nav-v2';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

interface SiteShellProps {
  children: React.ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}

const FULLSCREEN_PATTERNS = [/^\/(?:en|es)\/quiz\/[^/]+\/play$/, /^\/(?:en|es)\/quiz\/[^/]+\/result$/];

export function SiteShell({ children, locale, dictionary }: SiteShellProps) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_PATTERNS.some((pattern) => pattern.test(pathname));

  return (
    <>
      {!isFullscreen && <FloatingNavV2 locale={locale} dictionary={dictionary} />}
      <div className={isFullscreen ? '' : 'pb-24 md:pb-0'}>{children}</div>
      {!isFullscreen && <FooterV2 dictionary={dictionary} locale={locale} />}
      {!isFullscreen && <MobileNavV2 dictionary={dictionary} locale={locale} />}
    </>
  );
}
