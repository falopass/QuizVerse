import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rangeMock = vi.fn();
const createClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}));

import { getCategoryCounts } from '@/lib/data/category-counts';

describe('getCategoryCounts', () => {
  beforeEach(() => {
    rangeMock.mockReset();
    createClientMock.mockReset().mockResolvedValue({
      from: () => {
        const query = {
          eq: () => query,
          order: () => query,
          range: rangeMock,
        };
        return { select: () => query };
      },
    });
  });
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

  it('returns an empty map when the Supabase client cannot be created', async () => {
    createClientMock.mockRejectedValueOnce(new Error('missing env'));
    await expect(getCategoryCounts('en')).resolves.toEqual(new Map());
  });
});
