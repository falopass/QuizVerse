import { describe, expect, it, vi } from 'vitest';

const category = { id: 'culture', slug: 'culture', name: 'Culture' };
const quizRows = Array.from({ length: 502 }, (_, index) => ({
  id: String(index).padStart(4, '0'),
  slug: `quiz-${index}`,
  title: `Quiz ${index}`,
  category_id: 'culture',
  language: 'en',
  status: 'published',
  plays_count: 0,
  tags: [],
}));

/** Cuando está puesto, la consulta de tarjetas espera a que el test la suelte. */
let pageGate: Promise<void> | null = null;
let countsStarted = false;
const orderCalls: string[] = [];

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === 'categories'
        ? { select: () => ({ order: async () => ({ data: [category], error: null }) }) }
        : {
            select: (cols: string) => {
              const query = {
                eq: () => query,
                order: (field: string, options?: { ascending?: boolean }) => {
                  orderCalls.push(`${field}:${options?.ascending === false ? 'desc' : 'asc'}`);
                  return query;
                },
                range: async (from: number, to: number) => {
                  if (cols === 'category:categories(slug)') {
                    countsStarted = true;
                    return {
                      data: quizRows
                        .slice(from, to + 1)
                        .map(() => ({ category: { slug: 'culture' } })),
                      error: null,
                    };
                  }
                  if (pageGate) await pageGate;
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
  normalizeQuiz: (row: { category_id: string }, categories: Map<string, unknown>) => ({
    ...row,
    category: categories.get(row.category_id),
  }),
}));

import { getCategoryPayload } from '@/lib/data/public';

// getCategoryPayload está envuelta en cache() de React: cada `it` usa una
// página distinta para que la llamada llegue de verdad a los mocks.
describe('category paging', () => {
  it('serves 36 cards per page and reports the full total', async () => {
    const payload = await getCategoryPayload('culture', 'en');

    expect(payload?.quizzes).toHaveLength(36);
    expect(payload?.quizzes[0].id).toBe('0000');
    expect(payload?.totalQuizzes).toBe(502);
    expect(payload?.page).toBe(1);
    expect(payload?.pageCount).toBe(14);
  });

  it('serves the requested page from its offset', async () => {
    const payload = await getCategoryPayload('culture', 'en', 2);

    expect(payload?.quizzes).toHaveLength(36);
    expect(payload?.quizzes[0].id).toBe('0036');
    expect(payload?.page).toBe(2);
  });

  it('serves the short last page', async () => {
    const payload = await getCategoryPayload('culture', 'en', 14);

    expect(payload?.quizzes).toHaveLength(502 - 13 * 36);
    expect(payload?.quizzes[0].id).toBe('0468');
    expect(payload?.page).toBe(14);
  });

  it('returns an empty page past the end so the route can 404', async () => {
    const payload = await getCategoryPayload('culture', 'en', 15);

    expect(payload?.quizzes).toHaveLength(0);
    expect(payload?.totalQuizzes).toBe(502);
    expect(payload?.pageCount).toBe(14);
  });

  it('orders pages by plays_count with a deterministic id tiebreak', async () => {
    orderCalls.length = 0;
    await getCategoryPayload('personality', 'es', 3);

    const start = orderCalls.indexOf('plays_count:desc');
    expect(orderCalls.slice(start, start + 2)).toEqual(['plays_count:desc', 'id:asc']);
  });

  it('runs the category counts in parallel with the page query', async () => {
    let release!: () => void;
    pageGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    countsStarted = false;

    const pending = getCategoryPayload('personality', 'en', 2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // La consulta de tarjetas sigue pendiente y los conteos ya arrancaron:
    // no hay una espera en serie entre ambas.
    expect(countsStarted).toBe(true);

    release();
    pageGate = null;
    await pending;
  });
});
