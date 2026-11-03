'use client';

import { usePathname } from 'next/navigation';
import { EditorialErrorState } from '@/components/home/app-placeholders';
import { getErrorCopy } from '@/lib/i18n/dictionaries';
import { localeFromPathname } from '@/lib/i18n/navigation';
import './globals.css';

// Último recurso: cubre errores fuera de /[locale] (incluido el propio layout
// localizado), donde el pathname puede no llevar prefijo de idioma.
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const locale = localeFromPathname(usePathname());
  const copy = getErrorCopy(locale);

  return (
    <html lang={locale}>
      <body className="bg-bg-primary text-text-primary min-h-screen antialiased">
        <EditorialErrorState
          eyebrow={copy.eyebrow}
          title={copy.title}
          body={copy.body}
          onRetry={reset}
          retryLabel={copy.retry}
          homeHref={`/${locale}`}
          homeLabel={copy.home}
          browseHref={`/${locale}/quiz`}
          browseLabel={copy.browse}
        />
        {process.env.NODE_ENV === 'development' ? (
          <div className="mx-auto -mt-10 mb-16 max-w-3xl px-4">
            <pre className="overflow-auto rounded-2xl border border-rose-500/20 bg-rose-500/8 p-4 text-xs text-rose-900">
              {error.message}
            </pre>
          </div>
        ) : null}
      </body>
    </html>
  );
}
