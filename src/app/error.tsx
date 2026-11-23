'use client';

import { usePathname } from 'next/navigation';
import { EditorialErrorState, getErrorBoundaryCopy } from '@/components/home/app-placeholders';
import { localeFromPathname } from '@/lib/i18n/navigation';
import './globals.css';

// Último recurso: cubre errores fuera de /[locale] (incluido el propio layout
// localizado), donde el pathname puede no llevar prefijo de idioma.
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const locale = localeFromPathname(usePathname());
  const copy = getErrorBoundaryCopy(locale);

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
            <pre className="border-error/40 bg-bg-secondary text-error overflow-auto rounded-[4px] border p-4 text-xs">
              {error.message}
            </pre>
          </div>
        ) : null}
      </body>
    </html>
  );
}
