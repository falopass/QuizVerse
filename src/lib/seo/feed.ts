import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';
import { clampDescription } from './metadata';
import { SITE_NAME, absoluteUrl } from './site';

// Copia local: el escapador de sitemap.ts no se exporta y ese archivo no se toca.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface AtomFeedInput {
  locale: Locale;
  quizzes: Quiz[];
  /** ISO datetime del cambio más reciente; los lectores lo usan para omitir feeds sin cambios. */
  updated: string;
}

/**
 * Serializes the newest published quizzes as an Atom 1.0 document.
 *
 * Each quiz appears once per locale feed with an absolute link and an `id`
 * equal to that URL, so aggregators deduplicate entries across refreshes even
 * if `published`/`updated` timestamps move.
 */
export function buildAtomFeed({ locale, quizzes, updated }: AtomFeedInput): string {
  const selfUrl = absoluteUrl(`/${locale}/feed.xml`);
  const homeUrl = absoluteUrl(`/${locale}`);
  const feedTitle =
    locale === 'es' ? `${SITE_NAME} — Nuevos quizzes` : `${SITE_NAME} — New quizzes`;

  const entries = quizzes
    .map((quiz) => {
      const url = absoluteUrl(`/${locale}/quiz/${quiz.slug}`);
      const published = isoDate(quiz.published_at ?? quiz.created_at);
      const updatedAt = isoDate(quiz.updated_at) ?? published ?? new Date().toISOString();
      const parts = [
        `<title>${escapeXml(quiz.title)}</title>`,
        `<link href="${escapeXml(url)}"/>`,
        `<id>${escapeXml(url)}</id>`,
        published ? `<published>${published}</published>` : '',
        `<updated>${updatedAt}</updated>`,
        `<summary>${escapeXml(clampDescription(quiz.description))}</summary>`,
        `<author><name>${SITE_NAME}</name></author>`,
      ];
      return `  <entry>${parts.join('')}</entry>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(selfUrl)}</id>
  <title>${escapeXml(feedTitle)}</title>
  <updated>${escapeXml(updated)}</updated>
  <link rel="self" type="application/atom+xml" href="${escapeXml(selfUrl)}"/>
  <link rel="alternate" type="text/html" href="${escapeXml(homeUrl)}"/>
${entries}
</feed>
`;
}
