import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rangeMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        eq: () => query,
        range: rangeMock,
      };
      return { select: () => query };
    },
  }),
}));

import { getCategoryCounts } from '@/lib/data/category-counts';

describe('getCategoryCounts', () => {
  beforeEach(() => rangeMock.mockReset());
  it('counts quizzes per category slug', async () => {
    rangeMock.mockResolvedValueOnce({
      data: [
        { category: { slug: 'movies-tv' } },
        { category: { slug: 'movies-tv' } },
        { category: { slug: 'gaming' } },
        { category: null },
      ],
      error: null,
    });

    const counts = await getCategoryCounts('en');
    expect(counts.get('movies-tv')).toBe(2);
    expect(counts.get('gaming')).toBe(1);
    expect(counts.size).toBe(2);
  });

  it('paginates past 1000 rows until a short page', async () => {
    const page = (rows: { category: { slug: string } }[]) => ({ data: rows, error: null });
    rangeMock
      .mockResolvedValueOnce(
        page(Array.from({ length: 1000 }, () => ({ category: { slug: 'a' } })))
      )
      .mockResolvedValueOnce(page([{ category: { slug: 'b' } }]));

    const counts = await getCategoryCounts('en');
    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(counts.get('a')).toBe(1000);
    expect(counts.get('b')).toBe(1);
  });

  it('returns an empty map on query failure without throwing', async () => {
    rangeMock.mockResolvedValueOnce({ data: null, error: new Error('network down') });
    await expect(getCategoryCounts('en')).resolves.toEqual(new Map());
  });
});
