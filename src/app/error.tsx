'use client';

import { EditorialErrorState } from '@/components/home/app-placeholders';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <EditorialErrorState onRetry={reset} />
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
