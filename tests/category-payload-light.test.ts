import { describe, expect, it, vi } from 'vitest';

const culture = { id: 'culture', slug: 'culture', name: 'Culture' };
const movies = { id: 'movies', slug: 'movies-tv', name: 'Movies' };
const categories = [culture, movies];

const quizRows = [
  {
    id: 'q1',
    category_id: 'culture',
    language: 'en',
    status: 'published',
    title: 'Trivia A',
    questions: [{ text: 'q', options: [{ text: 'a', is_correct: true }] }],
    results: [{ tag: 'x', title: 'r' }],
  },
];

const COUNT_COLUMNS = 'category:categories(slug)';
const selects: string[] = [];
let failCounts = false;

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    from: (table: string) =>
      table === 'categories'
        ? {
            select: (cols: string) => {
              selects.push(`categories:${cols}`);
              return { order: async () => ({ data: categories, error: null }) };
            },
          }
        : {
            select: (cols: string) => {
              selects.push(`quizzes:${cols}`);
              const query = {
                eq: () => query,
                order: () => query,
                range: async (from: number, to: number) => {
                  if (cols === COUNT_COLUMNS) {
                    if (failCounts) return { data: null, error: { message: 'counts failed' } };
                    return {
                      data: quizRows
                        .map(() => ({ category: { slug: 'culture' } }))
                        .slice(from, to + 1),
                      error: null,
                    };
                  }
                  return {
                    data: quizRows.slice(from, to + 1),
                    error: null,
                    count: quizRows.length,
                  };
                },
              };
              return query;
            },
          },
  }),
}));
vi.mock('@/lib/data/normalizers', () => ({
  normalizeCategory: (row: unknown) => row,
  normalizeQuiz: (row: { category_id: string }, cats: Map<string, unknown>) => ({
    ...row,
    category: cats.get(row.category_id),
  }),
}));

import { CATEGORY_CARD_COLUMNS, getCategoryPayload } from '@/lib/data/public';

// getCategoryPayload está envuelta en cache() de React: cada `it` usa un slug
// distinto para que la llamada llegue de verdad a los mocks.
describe('category payload light', () => {
  it('strips questions and results from the returned quizzes', async () => {
    const payload = await getCategoryPayload('culture', 'en');
    expect(payload?.quizzes).toHaveLength(1);
    expect(payload?.quizzes[0].questions).toEqual([]);
    expect(payload?.quizzes[0].results).toBeNull();
    expect(payload?.quizzes[0].title).toBe('Trivia A');
  });

  it('lists only populated categories', async () => {
    const payload = await getCategoryPayload('movies-tv', 'en');
    expect(payload?.categories.map((item) => item.slug)).toEqual(['culture']);
  });

  it('counts populated categories without selecting full quiz rows', async () => {
    selects.length = 0;
    await getCategoryPayload('personality', 'en');
    expect(selects).toContain(`quizzes:${COUNT_COLUMNS}`);
  });

  it('selects only the card columns for the quiz page', async () => {
    selects.length = 0;
    await getCategoryPayload('personality', 'es');
    expect(selects).toContain(`quizzes:${CATEGORY_CARD_COLUMNS}`);
    expect(selects).not.toContain('quizzes:*');
  });

  it('never links empty categories when the counts query fails', async () => {
    failCounts = true;
    try {
      const payload = await getCategoryPayload('trivia', 'en');
      // Con el conteo caído solo se enlazan categorías con quizzes ya
      // cargados o del launch catalog; `movies-tv` (sin quizzes) no aparece.
      expect(payload?.categories.map((item) => item.slug)).toEqual(['culture']);
    } finally {
      failCounts = false;
    }
  });
});
