import { describe, expect, it } from 'vitest';
import { getLocalizedCategoryLabel, localizeCategory } from '@/lib/i18n/catalog';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category } from '@/types/quiz';

const THEME_SLUGS = [
  'movies-tv',
  'anime-manga',
  'gaming',
  'music',
  'culture',
  'lifestyle',
  'literature',
  'pop-culture',
  'technology',
  'relationships',
  'food-drink',
  'science',
  'animals',
  'sports',
  'geography',
  'history',
] as const;

const ALL_SLUGS = [...THEME_SLUGS, 'personality', 'trivia'] as const;
const LOCALES: Locale[] = ['en', 'es'];

const makeCategory = (slug: string): Category => ({
  id: `cat-${slug}`,
  name: slug,
  slug,
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 0,
  sort_order: 0,
});

describe('category descriptions', () => {
  it.each(ALL_SLUGS)('gives %s a non-empty name and description in both locales', (slug) => {
    for (const locale of LOCALES) {
      const localized = localizeCategory(makeCategory(slug), locale);
      expect(localized?.name.trim()).not.toBe('');
      expect(localized?.description?.trim()).not.toBe('');
    }
  });

  it.each(LOCALES)('does not repeat descriptions across categories in %s', (locale) => {
    const descriptions = ALL_SLUGS.map(
      (slug) => localizeCategory(makeCategory(slug), locale)?.description
    );
    expect(new Set(descriptions).size).toBe(ALL_SLUGS.length);
  });

  it.each(ALL_SLUGS)('keeps the %s spanish description distinct from the english one', (slug) => {
    const en = localizeCategory(makeCategory(slug), 'en')?.description;
    const es = localizeCategory(makeCategory(slug), 'es')?.description;
    expect(es).not.toBe(en);
  });

  it('localizes the science description in both locales', () => {
    const es = localizeCategory(makeCategory('science'), 'es');
    expect(es?.description).toBe(
      'Experimentos, descubrimientos, datos curiosos y cómo funciona el universo.'
    );

    const en = localizeCategory(makeCategory('science'), 'en');
    expect(en?.description).toBe('Experiments, discoveries, odd facts and how the universe works.');
  });

  it('resolves theme category labels from curated copy instead of the slug', () => {
    expect(getLocalizedCategoryLabel('food-drink', 'en')).toBe('Food & Drink');
    expect(getLocalizedCategoryLabel('food-drink', 'es')).toBe('Comida y bebida');
  });
});
