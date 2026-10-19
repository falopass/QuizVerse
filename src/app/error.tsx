'use client';

import { usePathname } from 'next/navigation';
import { EditorialErrorState } from '@/components/home/app-placeholders';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const pathname = usePathname();
  const es = pathname === '/es' || pathname.startsWith('/es/');
  const locale = es ? 'es' : 'en';

  return (
    <>
      <EditorialErrorState
        title={es ? 'Algo interrumpió el flujo.' : 'Something interrupted the flow.'}
        body={
          es
            ? 'La página no pudo terminar de cargar. Intenta de nuevo o vuelve al catálogo.'
            : 'The page could not finish loading. Try again, or jump back into the catalog.'
        }
        onRetry={reset}
        retryLabel={es ? 'Reintentar' : 'Try again'}
        homeHref={`/${locale}`}
        homeLabel={es ? 'Ir al inicio' : 'Go home'}
        browseHref={`/${locale}/quiz`}
        browseLabel={es ? 'Explorar quizzes' : 'Browse quizzes'}
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
