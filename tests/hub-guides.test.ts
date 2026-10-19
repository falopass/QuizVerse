import { describe, expect, it } from 'vitest';
import {
  getHubGuide,
  getRelatedCategories,
  HUB_GUIDES,
  RELATED_CATEGORIES,
} from '@/lib/content/hub-guides';

const HUB_SLUGS = ['trivia', 'personality'] as const;
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

const KNOWN_SLUGS = new Set([...POPULATED_SLUGS, ...HUB_SLUGS]);

const VOSEO_RE =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/;

describe('hub guides', () => {
  for (const slug of HUB_SLUGS) {
    for (const locale of LOCALES) {
      it(`${slug} (${locale}) tiene una intro editorial suficiente`, () => {
        const guide = getHubGuide(slug, locale);
        expect(guide).not.toBeNull();
        expect(guide!.intro.join(' ').length).toBeGreaterThanOrEqual(700);
      });

      it(`${slug} (${locale}) no usa voseo`, () => {
        const guide = getHubGuide(slug, locale)!;
        const copy = [guide.title, ...guide.intro, ...guide.howTo, guide.closing].join(' ');
        expect(VOSEO_RE.test(copy)).toBe(false);
      });
    }
  }

  it('solo trivia y personality tienen guía', () => {
    expect(Object.keys(HUB_GUIDES).sort()).toEqual([...HUB_SLUGS].sort());
    expect(getHubGuide('movies-tv', 'es')).toBeNull();
    expect(getHubGuide('music', 'en')).toBeNull();
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
