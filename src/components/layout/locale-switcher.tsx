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
    <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-text-muted">
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
            router.push(replacePathLocale(pathname || '/', nextLocale));
            router.refresh();
          }
        }}
        className={cn(
          'rounded-full border border-border-subtle bg-paper px-3 py-2 text-[11px] font-semibold tracking-[0.18em] text-text-primary',
          'outline-none transition-colors hover:border-accent focus:border-accent disabled:opacity-70'
        )}
      >
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    </label>
  );
}
