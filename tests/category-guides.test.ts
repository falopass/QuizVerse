import { describe, expect, it } from 'vitest';
import { CATEGORY_GUIDES, getCategoryGuide } from '@/lib/i18n/category-guides';
import { faqNode } from '@/lib/seo/structured-data';
import type { Locale } from '@/lib/i18n/dictionaries';

const CURATED_SLUGS = [
  'movies-tv',
  'anime-manga',
  'gaming',
  'music',
  'lifestyle',
  'culture',
  'literature',
  'pop-culture',
  'technology',
  'relationships',
];

const LOCALES: Locale[] = ['en', 'es'];

describe('CATEGORY_GUIDES', () => {
  it.each(CURATED_SLUGS)('has a curated guide for %s in both locales', (slug) => {
    const entry = CATEGORY_GUIDES[slug];
    expect(entry).toBeDefined();
    for (const locale of LOCALES) {
      expect(entry[locale]).toBeDefined();
    }
  });

  it.each(CURATED_SLUGS)('keeps the %s intro within the editorial length range', (slug) => {
    for (const locale of LOCALES) {
      const guide = CATEGORY_GUIDES[slug][locale];
      expect(guide.intro).toHaveLength(2);
      const length = guide.intro.join(' ').length;
      expect(length).toBeGreaterThanOrEqual(350);
      expect(length).toBeLessThanOrEqual(700);
    }
  });

  it.each(CURATED_SLUGS)('ships exactly 4 non-empty FAQ for %s', (slug) => {
    for (const locale of LOCALES) {
      const guide = CATEGORY_GUIDES[slug][locale];
      expect(guide.faq).toHaveLength(4);
      for (const item of guide.faq) {
        expect(item.question.trim()).not.toBe('');
        expect(item.answer.trim()).not.toBe('');
      }
    }
  });
});

describe('getCategoryGuide', () => {
  const genericCases: Array<[string, Locale]> = [
    ['unknown-slug', 'en'],
    ['personality', 'en'],
    ['personality', 'es'],
    ['trivia', 'en'],
    ['trivia', 'es'],
  ];

  it.each(genericCases)('builds a complete generic guide for %s/%s', (slug, locale) => {
    const guide = getCategoryGuide(slug, locale, 'Unknown', 3);

    expect(guide.intro).toHaveLength(2);
    for (const paragraph of guide.intro) {
      expect(paragraph.trim()).not.toBe('');
    }
    expect(guide.faq.length).toBeGreaterThan(0);
    for (const item of guide.faq) {
      expect(item.question.trim()).not.toBe('');
      expect(item.answer.trim()).not.toBe('');
    }
  });

  it('returns the curated object for a curated slug', () => {
    const guide = getCategoryGuide('movies-tv', 'en', 'Movies & TV', 174);
    expect(guide).toBe(CATEGORY_GUIDES['movies-tv'].en);
  });
});

describe('faqNode', () => {
  it('returns null when there are no items', () => {
    expect(faqNode([])).toBeNull();
  });

  it('emits a FAQPage with one Question per item', () => {
    const node = faqNode([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ]);

    expect(node).not.toBeNull();
    expect(node!['@type']).toBe('FAQPage');
    const mainEntity = node!.mainEntity as Array<Record<string, unknown>>;
    expect(mainEntity).toHaveLength(2);
    expect(mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q1',
      acceptedAnswer: { '@type': 'Answer', text: 'A1' },
    });
    expect(mainEntity[1]).toMatchObject({
      '@type': 'Question',
      name: 'Q2',
      acceptedAnswer: { '@type': 'Answer', text: 'A2' },
    });
  });
});
