/**
 * Quiz slug rules.
 *
 * Slugs are public URLs, so they are stable, ASCII and prefixed with the
 * language: `/en/quiz/en-oppenheimer-fan-trivia-challenge`. Collisions are
 * resolved by suffixing a counter, and the existence check is injected so the
 * rule stays testable without a database.
 */

export const MAX_SLUG_LENGTH = 80;

/** Lowercases, strips accents and punctuation, and caps the length. */
export function slugifyTitle(title: string, language?: string): string {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72);

  const safeBase = normalized || 'quiz';
  const prefix = language === 'es' || language === 'en' ? `${language}-` : '';

  return `${prefix}${safeBase}`.slice(0, MAX_SLUG_LENGTH).replace(/^-|-$/g, '');
}

export interface UniqueSlugOptions {
  language?: string;
  /** Resolves whether the candidate already exists. */
  exists: (candidate: string) => Promise<boolean>;
  /** Safety valve for pathological collision runs. */
  maxAttempts?: number;
}

/**
 * Returns a slug that does not exist yet: `base`, `base-2`, `base-3`…
 * Falls back to a timestamped slug if every attempt collides.
 */
export async function generateUniqueSlug(
  title: string,
  { language, exists, maxAttempts = 100 }: UniqueSlugOptions
): Promise<string> {
  const base = slugifyTitle(title, language);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${base}${suffix}`.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
    if (!(await exists(candidate))) return candidate;
  }

  return `${base}-${Date.now()}`.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}
