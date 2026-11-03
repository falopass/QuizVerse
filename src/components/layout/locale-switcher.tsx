'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { replacePathLocale } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';
import { trackEvent } from '@/lib/telemetry/client';

interface LocaleSwitcherProps {
  value: Locale;
  label: string;
}

export function LocaleSwitcher({ value, label }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = React.useState<Locale>(value);
  const [isSaving, setIsSaving] = React.useState(false);

  return (
    <label className="text-text-muted inline-flex items-center gap-2 text-xs font-semibold">
      <span>{label}</span>
      <select
        value={locale}
        disabled={isSaving}
        onChange={async (event) => {
          const nextLocale = event.target.value as Locale;
          setLocale(nextLocale);
          setIsSaving(true);

          try {
            await fetch('/api/locale', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ locale: nextLocale }),
            });
            await trackEvent({
              name: 'locale_switch',
              locale: nextLocale,
              path: pathname || '/',
              source: 'locale_switcher',
            });
          } finally {
            let href = replacePathLocale(pathname || '/', nextLocale);
            // La URL hreflang es la fuente de verdad: solo existe cuando la
            // página traducida existe de verdad (incl. el ?page=N de una
            // categoría con esa página hermana); sin ella va la URL limpia.
            const alternate = document.head.querySelector<HTMLLinkElement>(
              `link[rel="alternate"][hreflang="${nextLocale}"]`
            );
            if (alternate) {
              const url = new URL(alternate.href, window.location.origin);
              href = `${url.pathname}${url.search}${url.hash}`;
            }
            const quizSlug = pathname?.match(/^\/(en|es)\/quiz\/([^/]+)(?:\/.*)?$/)?.[2];
            if (quizSlug) {
              try {
                const response = await fetch(
                  `/api/quiz/locale?${new URLSearchParams({ slug: quizSlug, from: value, to: nextLocale })}`
                );
                if (response.ok) href = (await response.json()).href;
                else href = `/${nextLocale}`;
              } catch {
                href = `/${nextLocale}`;
              }
            }
            router.push(href);
            router.refresh();
            setIsSaving(false);
          }
        }}
        className={cn(
          'border-border-subtle bg-bg-secondary text-text-primary rounded-full border px-3 py-2 text-[11px] font-semibold',
          'hover:border-accent focus:border-accent transition-colors disabled:opacity-70'
        )}
      >
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    </label>
  );
}
