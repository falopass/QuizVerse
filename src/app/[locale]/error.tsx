'use client';

import { usePathname } from 'next/navigation';
import { EditorialErrorState } from '@/components/home/app-placeholders';
import { getErrorCopy } from '@/lib/i18n/dictionaries';

// Boundary dentro del SiteShell: nav y footer sobreviven al error. Como vive
// bajo /[locale], el primer segmento del pathname siempre es el locale real.
export default function LocalizedErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const segment = usePathname()?.split('/')[1] ?? 'en';
  const copy = getErrorCopy(segment);
  const locale = segment === 'es' ? 'es' : 'en';

  return (
    <>
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
    </>
  );
}
