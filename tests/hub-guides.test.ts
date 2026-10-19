import { describe, expect, it } from 'vitest';
import {
  getHubGuide,
  getRelatedCategories,
  HUB_GUIDES,
  RELATED_CATEGORIES,
} from '@/lib/content/hub-guides';

// The 2 type hubs plus the 8 theme categories with the largest catalogue.
const GUIDED_SLUGS = [
  'trivia',
  'personality',
  'movies-tv',
  'anime-manga',
  'gaming',
  'music',
  'lifestyle',
  'sports',
  'culture',
  'technology',
] as const;
const LOCALES = ['es', 'en'] as const;

// The 16 theme categories currently populated in the catalogue (see AGENTS.md).
const POPULATED_SLUGS: string[] = [
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
  'food-drink',
  'science',
  'animals',
  'sports',
  'geography',
  'history',
];

const KNOWN_SLUGS = new Set([...POPULATED_SLUGS, 'trivia', 'personality']);

const VOSEO_RE =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/;

describe('hub guides', () => {
  for (const slug of GUIDED_SLUGS) {
    for (const locale of LOCALES) {
      it(`${slug} (${locale}) tiene una intro editorial suficiente`, () => {
        const guide = getHubGuide(slug, locale);
        expect(guide).not.toBeNull();
        expect(guide!.intro.join(' ').length).toBeGreaterThanOrEqual(700);
      });

      it(`${slug} (${locale}) cumple la forma de HubGuide`, () => {
        const guide = getHubGuide(slug, locale)!;
        expect(guide.title.trim().length).toBeGreaterThan(0);
        expect(guide.intro.length).toBeGreaterThanOrEqual(2);
        expect(guide.intro.length).toBeLessThanOrEqual(3);
        for (const paragraph of guide.intro) {
          expect(paragraph.trim().length).toBeGreaterThan(0);
        }
        expect(guide.howTo).toHaveLength(3);
        expect(guide.closing.trim().length).toBeGreaterThan(0);
      });

      it(`${slug} (${locale}) no usa voseo`, () => {
        const guide = getHubGuide(slug, locale)!;
        const copy = [guide.title, ...guide.intro, ...guide.howTo, guide.closing].join(' ');
        expect(VOSEO_RE.test(copy)).toBe(false);
      });
    }
  }

  it('HUB_GUIDES cubre los 2 hubs de tipo y las 8 categorías principales', () => {
    expect(Object.keys(HUB_GUIDES).sort()).toEqual([...GUIDED_SLUGS].sort());
  });

  it('getHubGuide devuelve null para slugs sin guía', () => {
    expect(getHubGuide('history', 'es')).toBeNull();
    expect(getHubGuide('literature', 'en')).toBeNull();
    expect(getHubGuide('slug-desconocido', 'es')).toBeNull();
  });

  it('ninguna guía repite textos de otra guía', () => {
    const seen = new Map<string, string>();
    for (const locale of LOCALES) {
      for (const slug of Object.keys(HUB_GUIDES)) {
        const guide = HUB_GUIDES[slug][locale];
        for (const text of [guide.title, ...guide.intro, ...guide.howTo, guide.closing]) {
          expect(seen.has(text), `${slug} (${locale}) repite: ${text.slice(0, 60)}`).toBe(false);
          seen.set(text, `${slug}:${locale}`);
        }
      }
    }
  });

  it('RELATED_CATEGORIES cubre las 16 pobladas y los 2 hubs', () => {
    expect(Object.keys(RELATED_CATEGORIES).sort()).toEqual([...KNOWN_SLUGS].sort());
  });

  it('cada destino de RELATED_CATEGORIES existe en las 16 pobladas o en los 2 hubs', () => {
    for (const [slug, targets] of Object.entries(RELATED_CATEGORIES)) {
      expect(targets.length).toBeLessThanOrEqual(3);
      for (const target of targets) {
        expect(KNOWN_SLUGS.has(target), `${slug} -> ${target}`).toBe(true);
      }
    }
  });

  it('getRelatedCategories nunca incluye el propio slug y devuelve a lo más 3', () => {
    for (const slug of Object.keys(RELATED_CATEGORIES)) {
      const result = getRelatedCategories(slug, POPULATED_SLUGS);
      expect(result.length).toBeLessThanOrEqual(3);
      expect(result, slug).not.toContain(slug);
      for (const target of result) {
        expect(POPULATED_SLUGS).toContain(target);
      }
    }
  });

  it('getRelatedCategories respeta availableSlugs', () => {
    expect(getRelatedCategories('personality', ['relationships', 'gaming'])).toEqual([
      'relationships',
    ]);
    expect(getRelatedCategories('movies-tv', [])).toEqual([]);
    expect(getRelatedCategories('slug-inexistente', POPULATED_SLUGS)).toEqual([]);
  });
});
