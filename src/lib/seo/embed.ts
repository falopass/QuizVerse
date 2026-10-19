import type { Locale } from '@/lib/i18n/dictionaries';

export interface EmbedSnippet {
  /** Absolute URL of the frameable player (`/embed/{locale}/{slug}`). */
  embedUrl: string;
  /** Ready-to-paste HTML: iframe + a visible link back to the quiz. */
  snippet: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the iframe snippet a publisher pastes into their site.
 *
 * The canonical quiz URL (`{origin}/{locale}/quiz/{slug}`) carries both the
 * origin and the slug, so the embed URL can never drift from the page it
 * links back to. Returns null when the URL is not parseable: the invite bar
 * hides the button instead of copying a broken snippet.
 */
export function buildEmbedSnippet(
  canonicalUrl: string,
  locale: Locale,
  title?: string
): EmbedSnippet | null {
  let url: URL;
  try {
    url = new URL(canonicalUrl);
  } catch {
    return null;
  }

  const slug = url.pathname.replace(/\/+$/, '').split('/').pop();
  if (!slug) return null;

  const embedUrl = `${url.origin}/embed/${locale}/${slug}`;
  const label = (title ?? '').trim() || 'QuizVerse';
  const escapedLabel = escapeHtml(label);
  const linkText =
    locale === 'es'
      ? `Juega “${escapedLabel}” en QuizVerse`
      : `Play “${escapedLabel}” on QuizVerse`;

  const snippet =
    `<iframe src="${escapeHtml(embedUrl)}" width="600" height="720" ` +
    `style="border:0;border-radius:12px;max-width:100%" loading="lazy" ` +
    `title="${escapedLabel} | QuizVerse"></iframe>\n` +
    `<p><a href="${escapeHtml(canonicalUrl)}" target="_blank" rel="noopener">${linkText}</a></p>`;

  return { embedUrl, snippet };
}
