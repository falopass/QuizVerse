import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { NotFoundContent } from '@/components/layout/not-found-content';
import { SiteDocument } from '@/components/layout/site-document';

// Los layouts raíz están bajo [locale] y embed/[locale]. Solo el 404 global
// necesita el header del proxy: no tiene params ni participa del HTML público.
export async function generateMetadata(): Promise<Metadata> {
  const es = (await headers()).get('x-quizverse-locale') === 'es';
  return { title: es ? 'Página no encontrada' : 'Page not found' };
}

export default async function NotFoundPage() {
  const locale = (await headers()).get('x-quizverse-locale') === 'es' ? 'es' : 'en';
  return (
    <SiteDocument locale={locale}>
    <main id="main-content" className="min-h-[70vh] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-4xl">
        <NotFoundContent locale={locale} />
      </div>
    </main>
    </SiteDocument>
  );
}
