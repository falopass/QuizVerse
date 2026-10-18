import { describe, expect, it, vi } from 'vitest';

const category = { id: 'culture', slug: 'culture', name: 'Culture' };
const quizRows = Array.from({ length: 502 }, (_, index) => ({
  id: String(index),
  category_id: 'culture',
  language: 'en',
  status: 'published',
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === 'categories'
        ? { select: () => ({ order: async () => ({ data: [category], error: null }) }) }
        : {
            select: () => {
              const query = {
                eq: () => query,
                order: () => query,
                range: async (from: number, to: number) => ({
                  data: quizRows.slice(from, to + 1),
                  error: null,
                }),
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

describe('category paging', () => {
  it('shows every matching quiz beyond the old 80 item cap', async () => {
    const payload = await getCategoryPayload('culture', 'en');
    expect(payload?.quizzes).toHaveLength(502);
    expect(payload?.quizzes[501].category?.slug).toBe('culture');
  });
});
