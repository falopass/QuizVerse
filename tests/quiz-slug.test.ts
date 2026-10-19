/**
 * Tests for quiz slug generation.
 *
 * Slugs are public URLs: they must stay ASCII, carry the language prefix and
 * resolve collisions with a numeric suffix without exceeding MAX_SLUG_LENGTH.
 * These tests lock in the CURRENT behavior of src/lib/quiz/quiz-slug.ts.
 */

import { describe, expect, it, vi } from 'vitest';
import { MAX_SLUG_LENGTH, generateUniqueSlug, slugifyTitle } from '@/lib/quiz/quiz-slug';

describe('slugifyTitle', () => {
  it('strips accents, ñ and ü to plain ASCII', () => {
    expect(slugifyTitle('El Niño y la Cúpula')).toBe('el-nino-y-la-cupula');
    expect(slugifyTitle('¿Qué personaje eres?')).toBe('que-personaje-eres');
    expect(slugifyTitle('Ünïcö Çháractérs')).toBe('unico-characters');
  });

  it('turns spaces and symbols into hyphens and expands & to and', () => {
    expect(slugifyTitle('Star Wars & Friends')).toBe('star-wars-and-friends');
    expect(slugifyTitle('Cine: ¡Lo mejor!')).toBe('cine-lo-mejor');
  });

  it('collapses repeated hyphens and trims hyphens at the edges', () => {
    expect(slugifyTitle('Hola   ---   mundo!!!')).toBe('hola-mundo');
    expect(slugifyTitle('  --Hola--  ')).toBe('hola');
  });

  it('lowercases the whole slug', () => {
    expect(slugifyTitle('LOUD TITLE')).toBe('loud-title');
  });

  it('falls back to quiz when nothing usable remains', () => {
    expect(slugifyTitle('!!!')).toBe('quiz');
    expect(slugifyTitle('')).toBe('quiz');
  });

  it('prefixes only en and es', () => {
    expect(slugifyTitle('Trivia', 'en')).toBe('en-trivia');
    expect(slugifyTitle('Trivia', 'es')).toBe('es-trivia');
    expect(slugifyTitle('Trivia', 'fr')).toBe('trivia');
    expect(slugifyTitle('Trivia')).toBe('trivia');
  });

  it('caps the result at MAX_SLUG_LENGTH without a trailing hyphen', () => {
    const longTitle = 'palabra '.repeat(30).trim(); // 239 chars
    const slug = slugifyTitle(longTitle, 'en');
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug).toMatch(/^en-[a-z0-9-]*[a-z0-9]$/);
    // The base is sliced at 72 chars before the prefix is added.
    expect(slug.length).toBeLessThanOrEqual(72 + 'en-'.length);
  });
});

describe('generateUniqueSlug', () => {
  const free = async () => false;
  const takenFrom = (taken: ReadonlySet<string>) => async (candidate: string) =>
    taken.has(candidate);

  it('returns the bare slug when the first candidate is free', async () => {
    const exists = vi.fn(free);
    await expect(generateUniqueSlug('Fresh Title', { exists })).resolves.toBe('fresh-title');
    expect(exists).toHaveBeenCalledTimes(1);
    expect(exists).toHaveBeenCalledWith('fresh-title');
  });

  it('adds -2 on a single collision', async () => {
    const slug = await generateUniqueSlug('Quiz', {
      language: 'en',
      exists: takenFrom(new Set(['en-quiz'])),
    });
    expect(slug).toBe('en-quiz-2');
  });

  it('walks a collision series until one is free', async () => {
    const taken = new Set(['en-quiz', 'en-quiz-2', 'en-quiz-3']);
    const slug = await generateUniqueSlug('Quiz', {
      language: 'en',
      exists: takenFrom(taken),
    });
    expect(slug).toBe('en-quiz-4');
  });

  it('keeps suffixed candidates within MAX_SLUG_LENGTH on long titles', async () => {
    // slugifyTitle caps the base at 72 chars (+3 for the prefix), so the
    // numeric suffix always fits inside MAX_SLUG_LENGTH.
    const title = `a${'b'.repeat(100)}`; // slugifies to 'en-' + 72 chars
    const base = slugifyTitle(title, 'en');
    expect(base.length).toBe(75);
    const slug = await generateUniqueSlug(title, {
      language: 'en',
      exists: takenFrom(new Set([base])),
    });
    expect(slug).toBe(`${base}-2`);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
  });

  it('falls back to a timestamped slug after maxAttempts', async () => {
    const exists = vi.fn(async () => true);
    const slug = await generateUniqueSlug('Quiz', { exists, maxAttempts: 3 });
    expect(exists).toHaveBeenCalledTimes(3);
    expect(slug).toMatch(/^quiz-\d+$/);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
  });
});
