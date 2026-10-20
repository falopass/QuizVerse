import { describe, expect, it } from 'vitest';
import { buildCatalogIndex, UNCATEGORIZED_GROUP_SLUG } from '@/lib/content/catalog-index';
import type { CatalogCard } from '@/lib/data/catalog-cards';
import type { Category, Quiz } from '@/types/quiz';

const category = (slug: string, name: string): Category => ({
  id: slug,
  name,
  slug,
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 0,
  sort_order: 0,
});

const MOVIES = category('movies-tv', 'Movies & TV');
const ANIME = category('anime-manga', 'Anime & Manga');
const GAMING = category('gaming', 'Gaming');

const quiz = (
  slug: string,
  title: string,
  quiz_type: Quiz['quiz_type'],
  cat: Category | null
): Quiz => ({
  id: slug,
  slug,
  title,
  description: null,
  cover_image_url: null,
  quiz_type,
  difficulty: 'medium',
  language: 'en',
  questions: [],
  results: null,
  tags: [],
  estimated_minutes: 5,
  plays_count: 0,
  shares_count: 0,
  avg_score: null,
  likes_count: 0,
  status: 'published',
  is_featured: false,
  is_ai_generated: false,
  published_at: null,
  updated_at: null,
  created_at: '2026-01-01',
  category: cat,
});

// 6 quizzes únicos: 3 en movies-tv, 1 en anime-manga, 1 en gaming y 1 huérfano
// (sin categoría, que va al grupo sintético final). El duplicado de slug no
// debe enlazarse dos veces.
const FIXTURE: Quiz[] = [
  quiz('charlie', 'Charlie movie quiz', 'trivia', MOVIES),
  quiz('alpha', 'Alpha movie quiz', 'trivia', MOVIES),
  quiz('beta', 'Beta movie quiz', 'personality', MOVIES),
  quiz('delta', 'Delta anime quiz', 'personality', ANIME),
  quiz('echo', 'Echo gaming quiz', 'personality', GAMING),
  quiz('foxtrot', 'Foxtrot orphan quiz', 'trivia', null),
  quiz('alpha', 'Alpha movie quiz (dup)', 'trivia', MOVIES),
];

describe('buildCatalogIndex', () => {
  const index = buildCatalogIndex(FIXTURE, 'en');

  it('agrupa por categoría, ordena por cantidad y nombre, y cierra con los huérfanos', () => {
    expect(index.groups.map((group) => group.slug)).toEqual([
      'movies-tv',
      'anime-manga',
      'gaming',
      UNCATEGORIZED_GROUP_SLUG,
    ]);
    expect(index.groups[0].quizzes.map((item) => item.slug)).toEqual(['alpha', 'beta', 'charlie']);
    expect(index.groups[3].quizzes.map((item) => item.slug)).toEqual(['foxtrot']);
    expect(index.groups[3].name).toBe('Uncategorized');
  });

  it('no pierde quizzes: todos quedan enlazados y sin duplicados', () => {
    expect(index.total).toBe(6);
    const linked = index.groups.flatMap((group) => group.quizzes.map((item) => item.slug));
    expect(linked).toContain('foxtrot');
    expect(linked.filter((slug) => slug === 'alpha')).toHaveLength(1);
    expect(linked).toHaveLength(6);
  });

  it('localiza el nombre de cada grupo', () => {
    expect(index.groups[0].name).toBe('Movies & TV');
    const es = buildCatalogIndex(FIXTURE, 'es');
    expect(es.groups[0].name).toBe('Cine y televisión');
  });

  it('hubs incluye los tipos presentes y las categorías pobladas', () => {
    expect(index.hubs.map((hub) => hub.slug)).toEqual([
      'trivia',
      'personality',
      'movies-tv',
      'anime-manga',
      'gaming',
    ]);
    expect(index.hubs.find((hub) => hub.slug === 'trivia')?.count).toBe(3);
    expect(index.hubs.find((hub) => hub.slug === 'personality')?.count).toBe(3);
    expect(index.hubs.find((hub) => hub.slug === 'movies-tv')?.count).toBe(3);
    expect(index.hubs.find((hub) => hub.slug === 'trivia')?.name).toBe('Trivia');
  });

  it('omite hubs de tipo sin quizzes', () => {
    const onlyTrivia = buildCatalogIndex([quiz('solo', 'Solo', 'trivia', MOVIES)], 'en');
    expect(onlyTrivia.hubs.map((hub) => hub.slug)).toEqual(['trivia', 'movies-tv']);
  });

  it('no repite un hub si una categoría comparte el slug de un tipo', () => {
    // El catálogo de lanzamiento tiene categorías "trivia"/"personality":
    // en el fallback un grupo podría chocar con el hub de tipo.
    const fallback = buildCatalogIndex(
      [quiz('t1', 'T1', 'trivia', category('trivia', 'Trivia'))],
      'en'
    );
    expect(fallback.hubs.filter((hub) => hub.slug === 'trivia')).toHaveLength(1);
    expect(fallback.groups.map((group) => group.slug)).toEqual(['trivia']);
  });

  it('uncategorized nunca es hub ni aparece sin huérfanos', () => {
    expect(index.hubs.map((hub) => hub.slug)).not.toContain(UNCATEGORIZED_GROUP_SLUG);
    const allCategorized = buildCatalogIndex([quiz('x', 'X', 'trivia', MOVIES)], 'en');
    expect(allCategorized.groups.map((group) => group.slug)).toEqual(['movies-tv']);
  });

  it('produce el mismo índice con el catálogo completo que con tarjetas ligeras', () => {
    // Misma proyección que getCatalogCards: /indice pinta idéntico HTML con
    // CatalogCard[] que con Quiz[] (PERF-07).
    const cards: CatalogCard[] = FIXTURE.map((item) => ({
      slug: item.slug,
      title: item.title,
      quiz_type: item.quiz_type,
      category: item.category ? { slug: item.category.slug, name: item.category.name } : null,
    }));

    for (const locale of ['en', 'es'] as const) {
      expect(buildCatalogIndex(cards, locale)).toEqual(buildCatalogIndex(FIXTURE, locale));
    }
  });
});
