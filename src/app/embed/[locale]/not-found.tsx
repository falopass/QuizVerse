'use client';

import { usePathname } from 'next/navigation';
import { SITE_URL } from '@/lib/seo/site';

// Embed lives outside [locale] (no SiteShell on purpose), so it needs its own
// boundary: without it, notFound() in embed/[locale]/[slug] falls back to the
// root not-found, which streams client-side only and leaves a blank iframe.
export default function EmbedNotFound() {
  const pathname = usePathname();
  const es = pathname.startsWith('/embed/es');

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="text-text-primary mt-2 text-2xl font-semibold">
          {es ? 'Este quiz no existe.' : 'This quiz does not exist.'}
        </h1>
        <a
          href={es ? `${SITE_URL}/es` : `${SITE_URL}/en`}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-block text-sm font-semibold text-[var(--accent-primary)] hover:underline"
        >
          {es ? 'Explora quizzes en QuizVerse' : 'Explore quizzes on QuizVerse'}
        </a>
      </div>
    </main>
  );
}
