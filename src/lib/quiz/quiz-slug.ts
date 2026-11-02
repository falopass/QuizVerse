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

/** Length of the random suffix that marks a slug as provisional. */
const PROVISIONAL_SUFFIX_LENGTH = 6;

/**
 * Provisional slug for an unpublished quiz: `base-<random>`.
 *
 * A draft that took the clean `base` would leak the existence of someone
 * else's private quiz: RLS hides other creators' drafts and pending quizzes,
 * so the only observable of a collision is the returned slug itself. With a
 * random suffix the answer is the same whether a hidden quiz holds the base
 * or not. The definitive slug is generated at publish time.
 */
export function provisionalSlug(title: string, language?: string): string {
  const suffix = randomSuffix(PROVISIONAL_SUFFIX_LENGTH);
  const base = slugifyTitle(title, language)
    .slice(0, MAX_SLUG_LENGTH - suffix.length - 1)
    .replace(/-+$/g, '');
  return `${base}-${suffix}`;
}

/** `length` base36 characters; uniqueness rests on the unique constraint. */
function randomSuffix(length: number): string {
  let suffix = '';
  while (suffix.length < length) suffix += Math.random().toString(36).slice(2);
  return suffix.slice(0, length);
}
