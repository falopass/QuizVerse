/**
 * `getCatalogStats` suma `plays_count` de los quizzes publicados. PostgREST
 * corta cada respuesta en `max-rows` (1000): la suma debe paginar, no leer solo
 * la primera página.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const MAX_ROWS = 1000;
const state = {
  rows: [] as Array<{ plays_count: number | null }>,
  playsError: null as { message: string } | null,
  ranges: [] as Array<[number, number]>,
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      // Los counts se esperan directamente (thenable); la suma usa order + range.
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: async (from: number, to: number) => {
          state.ranges.push([from, to]);
          if (state.playsError) return { data: null, error: state.playsError };
          return {
            data: state.rows.slice(from, Math.min(to + 1, from + MAX_ROWS)),
            error: null,
          };
        },
        then: (resolve: (value: { count: number; error: null }) => unknown) =>
          resolve({ count: 7, error: null }),
      };
      return builder;
    },
  }),
}));

import { getCatalogStats } from '@/lib/data/catalog';

describe('getCatalogStats', () => {
  beforeEach(() => {
    state.rows = [];
    state.playsError = null;
    state.ranges = [];
  });

  it('suma las partidas de todas las páginas y no solo de la primera', async () => {
    state.rows = Array.from({ length: 2350 }, (_, i) => ({ plays_count: i % 3 === 0 ? null : 2 }));

    const stats = await getCatalogStats();

    const expected = state.rows.reduce((sum, row) => sum + (row.plays_count ?? 0), 0);
    expect(stats.plays).toBe(expected);
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('con una sola página no pide más', async () => {
    state.rows = [{ plays_count: 5 }, { plays_count: 6 }];

    const stats = await getCatalogStats();

    expect(stats.plays).toBe(11);
    expect(state.ranges).toEqual([[0, 999]]);
  });

  it('propaga el error de la consulta de partidas', async () => {
    state.playsError = { message: 'boom' };

    await expect(getCatalogStats()).rejects.toThrow('stats_query_failed: boom');
  });
});
