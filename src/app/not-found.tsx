import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { NotFoundContent } from '@/components/layout/not-found-content';

// Root not-found is the last resort for URLs outside [locale] (unmatched
// routes, invalid locale segments, /embed/* misses). Locale comes from the
// proxy header because this file sits outside the [locale] segment.
export async function generateMetadata(): Promise<Metadata> {
  const es = (await headers()).get('x-quizverse-locale') === 'es';
  return { title: es ? 'Página no encontrada' : 'Page not found' };
}

export default async function NotFoundPage() {
  const locale = (await headers()).get('x-quizverse-locale') === 'es' ? 'es' : 'en';
  return (
    <main id="main-content" className="min-h-[70vh] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-4xl">
        <NotFoundContent locale={locale} />
      </div>
    </main>
  );
}
