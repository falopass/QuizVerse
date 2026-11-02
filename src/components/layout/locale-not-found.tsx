'use client';

import { usePathname } from 'next/navigation';
import { NotFoundContent } from '@/components/layout/not-found-content';

// Next gives not-found boundaries no `params`, so the locale comes from the
// URL segment — the same trick `src/app/error.tsx` already uses. Reading it
// here (instead of the `x-quizverse-locale` request header) also works when
// the header does not reach the 404 render under OpenNext.
export function LocaleNotFoundContent() {
  const pathname = usePathname();
  const locale = pathname === '/es' || pathname.startsWith('/es/') ? 'es' : 'en';

  return (
    <div className="min-h-[70vh] px-4 pt-28 pb-16">
      <div className="mx-auto max-w-4xl">
        <NotFoundContent locale={locale} />
      </div>
    </div>
  );
}
