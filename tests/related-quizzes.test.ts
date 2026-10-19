import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createClientCalls: 0,
  limitCalls: [] as Array<{ byCategory: boolean; n: number }>,
  categories: [] as Array<{ id: string; slug: string; name: string }>,
  categoryRows: [] as Array<Record<string, unknown>>,
  popularRows: [] as Array<Record<string, unknown>>,
  quizError: null as Error | null,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    state.createClientCalls += 1;
    return {
      from: (table: string) =>
        table === 'categories'
          ? {
              select: () => ({
                order: async () => ({ data: state.categories, error: null }),
              }),
            }
          : {
              select: () => {
                const query = {
                  byCategory: false,
                  eq: (column: string) => {
                    if (column === 'category_id') query.byCategory = true;
                    return query;
                  },
                  neq: () => query,
                  order: () => query,
                  limit: async (n: number) => {
                    state.limitCalls.push({ byCategory: query.byCategory, n });
                    if (state.quizError) return { data: null, error: state.quizError };
                    const rows = query.byCategory ? state.categoryRows : state.popularRows;
                    return { data: rows.slice(0, n), error: null };
                  },
                };
                return query;
              },
            },
    };
  },
}));
vi.mock('@/lib/data/normalizers', () => ({
  normalizeCategory: (row: unknown) => row,
  normalizeQuiz: (row: Record<string, unknown>, categories: Map<string, unknown>) => ({
    ...row,
    category: categories.get(row.category_id as string) ?? null,
  }),
}));

import { getRelatedQuizzes } from '@/lib/data/public';

const history = { id: 'cat-history', slug: 'history', name: 'Historia' };
const movies = { id: 'cat-movies', slug: 'movies-tv', name: 'Peliculas' };

function row(slug: string, categoryId: string, playsCount = 0) {
  return {
    id: `id-${slug}`,
    slug,
    category_id: categoryId,
    language: 'es',
    status: 'published',
    plays_count: playsCount,
  };
}

describe('getRelatedQuizzes', () => {
  beforeEach(() => {
    state.createClientCalls = 0;
    state.limitCalls = [];
    state.categories = [history, movies];
    state.categoryRows = [];
    state.popularRows = [];
    state.quizError = null;
  });

  it('completa hasta 3 con los más jugados del idioma, sin duplicados', async () => {
    state.categoryRows = [row('hist-b', history.id, 10)];
    state.popularRows = [
      row('hist-b', history.id, 999), // ya salió en la consulta por categoría
      row('pop-1', movies.id, 900),
      row('pop-2', movies.id, 800),
      row('pop-3', movies.id, 700),
    ];

    const related = await getRelatedQuizzes('hist-a', 'history', 'es');

    expect(related.map((quiz) => quiz.slug)).toEqual(['hist-b', 'pop-1', 'pop-2']);
    expect(state.limitCalls).toEqual([
      { byCategory: true, n: 3 },
      { byCategory: false, n: 10 },
    ]);
  });

  it('no dispara la segunda consulta si la categoría ya trae 3', async () => {
    state.categoryRows = [
      row('hist-b', history.id, 30),
      row('hist-c', history.id, 20),
      row('hist-d', history.id, 10),
    ];
    state.popularRows = [row('pop-1', movies.id, 900)];

    const related = await getRelatedQuizzes('hist-a', 'history', 'es');

    expect(related.map((quiz) => quiz.slug)).toEqual(['hist-b', 'hist-c', 'hist-d']);
    expect(state.limitCalls).toEqual([{ byCategory: true, n: 3 }]);
  });

  it('devuelve [] sin tocar Supabase cuando no hay categorySlug', async () => {
    expect(await getRelatedQuizzes('hist-a', null, 'es')).toEqual([]);
    expect(state.createClientCalls).toBe(0);
  });

  it('cae al catálogo de lanzamiento cuando Supabase falla', async () => {
    state.quizError = new Error('db down');

    const related = await getRelatedQuizzes('x', 'culture', 'en');

    expect(related.length).toBeGreaterThan(0);
    expect(related.every((quiz) => quiz.category?.slug === 'culture')).toBe(true);
    expect(related.every((quiz) => quiz.language === 'en')).toBe(true);
  });
});
