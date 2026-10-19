import { describe, expect, it } from 'vitest';
import {
  categoryPath,
  itemListNode,
  quizPath,
  webPageNode,
  websiteNode,
} from '@/lib/seo/structured-data';
import { SITE_URL } from '@/lib/seo/site';

const items = [
  { name: 'Space Trivia', path: '/es/quiz/trivia-espacial' },
  { name: 'Noche de cine', path: '/es/quiz/noche-de-cine' },
];

describe('itemListNode', () => {
  it('returns null for an empty list', () => {
    expect(itemListNode([], 'es')).toBeNull();
  });

  it('counts items and numbers positions from 1', () => {
    const node = itemListNode(items, 'es');

    expect(node).toMatchObject({ '@type': 'ItemList', numberOfItems: 2 });
    const elements = node?.itemListElement as Array<Record<string, unknown>>;
    expect(elements.map((element) => element.position)).toEqual([1, 2]);
    expect(elements.map((element) => element.name)).toEqual([
      'Space Trivia',
      'Noche de cine',
    ]);
  });

  it('emits absolute https URLs for every list element', () => {
    const node = itemListNode(items, 'es');
    const elements = node?.itemListElement as Array<{ url: string }>;

    for (const element of elements) {
      expect(element.url).toMatch(/^https:\/\//);
      expect(element.url.startsWith(SITE_URL)).toBe(true);
    }
    expect(elements[0].url).toBe(`${SITE_URL}/es/quiz/trivia-espacial`);
  });

  it('defaults the list name by locale', () => {
    expect(itemListNode(items, 'es')?.name).toBe('Quizzes de QuizVerse');
    expect(itemListNode(items, 'en')?.name).toBe('QuizVerse quizzes');
  });

  it('honors a custom list name', () => {
    expect(itemListNode(items, 'es', 'Tendencia')?.name).toBe('Tendencia');
  });
});

describe('webPageNode', () => {
  it('emits a WebPage anchored to #webpage and part of #website', () => {
    const node = webPageNode('/es/quiz/mi-quiz', 'es', 'Mi quiz');

    expect(node['@type']).toBe('WebPage');
    expect(node['@id']).toBe(`${SITE_URL}/es/quiz/mi-quiz#webpage`);
    expect(String(node['@id'])).toMatch(/#webpage$/);
    expect(node.url).toBe(`${SITE_URL}/es/quiz/mi-quiz`);
    expect(node.inLanguage).toBe('es');
    expect(node.name).toBe('Mi quiz');
  });

  it('points isPartOf at the real WebSite @id', () => {
    const node = webPageNode('/es/quiz/mi-quiz', 'es', 'Mi quiz');
    const website = websiteNode('es');

    expect(node.isPartOf).toEqual({ '@id': website['@id'] });
    expect(node.isPartOf).toEqual({ '@id': `${SITE_URL}/#website` });
  });
});

describe('categoryPath and quizPath', () => {
  it('prefixes the locale', () => {
    expect(categoryPath('es', 'movies-tv')).toBe('/es/category/movies-tv');
    expect(quizPath('en', 'space-trivia')).toBe('/en/quiz/space-trivia');
  });

  it('percent-encodes spaces and unsafe characters via safePath', () => {
    expect(categoryPath('es', 'movies tv')).toBe('/es/category/movies%20tv');
    expect(quizPath('en', 'a&b')).toBe('/en/quiz/a%26b');
  });

  it('does not let a stray slash split the slug into extra segments', () => {
    expect(quizPath('en', 'a/b')).toBe('/en/quiz/a%2Fb');
    expect(categoryPath('es', 'a/b')).toBe('/es/category/a%2Fb');
  });
});
