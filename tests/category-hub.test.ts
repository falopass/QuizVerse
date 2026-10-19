import { describe, expect, it } from 'vitest';

import { buildCategoryHub, categoryHubCopy } from '@/lib/content/category-hub';
import type { Category } from '@/types/quiz';

function category(slug: string, name: string): Category {
  return {
    id: slug,
    slug,
    name,
    description: `${name} description`,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 0,
    sort_order: 0,
  };
}

const CATEGORIES = [
  category('movies-tv', 'Movies & TV'),
  category('gaming', 'Gaming'),
  category('music', 'Music'),
  category('empty-topic', 'Empty Topic'),
];

const COUNTS = new Map([
  ['movies-tv', 30],
  ['gaming', 50],
  ['music', 10],
]);

const TYPE_COUNTS = new Map([
  ['trivia', 120],
  ['personality', 90],
]);

describe('buildCategoryHub', () => {
  it('excluye las categorías sin quizzes publicados', () => {
    const items = buildCategoryHub(CATEGORIES, COUNTS, TYPE_COUNTS, 'es');
    expect(items.some((item) => item.slug === 'empty-topic')).toBe(false);
    expect(items.some((item) => item.kind === 'category' && item.count <= 0)).toBe(false);
  });

  it('incluye siempre los dos hubs de tipo, aunque no haya conteo', () => {
    const items = buildCategoryHub(CATEGORIES, COUNTS, new Map(), 'en');
    const types = items.filter((item) => item.kind === 'type');
    expect(types.map((item) => item.slug).sort()).toEqual(['personality', 'trivia']);
    expect(types.every((item) => item.count === 0)).toBe(true);
  });

  it('usa el conteo de tipo cuando existe', () => {
    const items = buildCategoryHub(CATEGORIES, COUNTS, TYPE_COUNTS, 'en');
    expect(items.find((item) => item.slug === 'trivia')?.count).toBe(120);
    expect(items.find((item) => item.slug === 'personality')?.count).toBe(90);
  });

  it('ordena por conteo descendente y desempata por nombre', () => {
    const items = buildCategoryHub(CATEGORIES, COUNTS, TYPE_COUNTS, 'en');
    expect(items.map((item) => item.slug)).toEqual([
      'trivia',
      'personality',
      'gaming',
      'movies-tv',
      'music',
    ]);

    const tied = buildCategoryHub(
      [category('music', 'Music'), category('movies-tv', 'Movies & TV')],
      new Map([
        ['music', 10],
        ['movies-tv', 10],
      ]),
      new Map(),
      'en'
    );
    expect(tied.map((item) => item.slug)).toEqual(['movies-tv', 'music', 'personality', 'trivia']);
  });

  it('arma hrefs localizados hacia /category/<slug>', () => {
    const items = buildCategoryHub(CATEGORIES, COUNTS, TYPE_COUNTS, 'es');
    expect(items.find((item) => item.slug === 'gaming')?.href).toBe('/es/category/gaming');
    expect(items.find((item) => item.slug === 'trivia')?.href).toBe('/es/category/trivia');
  });

  it('localiza nombres y descripciones de los hubs de tipo', () => {
    const items = buildCategoryHub(CATEGORIES, COUNTS, TYPE_COUNTS, 'es');
    const personality = items.find((item) => item.slug === 'personality');
    expect(personality?.name).toBe('Personalidad');
    expect(personality?.description).toBeTruthy();
  });
});

describe('categoryHubCopy', () => {
  it.each(['en', 'es'] as const)('devuelve textos no vacíos en %s', (locale) => {
    const copy = categoryHubCopy(locale);
    expect(Object.keys(copy).length).toBeGreaterThan(0);
    for (const value of Object.values(copy)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
