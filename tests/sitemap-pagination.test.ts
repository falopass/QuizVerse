/**
 * PostgREST corta cada respuesta en `max-rows` (1000): el sitemap debe paginar
 * con `range` y listar todos los quizzes publicados, no solo la primera página.
 */

import { describe, expect, it, vi } from 'vitest';

const TOTAL = 2350;
const MAX_ROWS = 1000;

const quizRows = Array.from({ length: TOTAL }, (_, i) => ({
  slug: `${i % 2 === 0 ? 'en' : 'es'}-quiz-${String(i).padStart(4, '0')}`,
  language: i % 2 === 0 ? 'en' : 'es',
  published_at: '2026-11-04T00:00:00Z',
  updated_at: null,
  quiz_type: 'trivia',
  category_id: null,
  category: null,
}));

const ranges: Array<[number, number]> = [];

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        // Igual que PostgREST: nunca devuelve más de `max-rows` filas.
        range: async (from: number, to: number) => {
          ranges.push([from, to]);
          return { data: quizRows.slice(from, Math.min(to + 1, from + MAX_ROWS)), error: null };
        },
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: () => null,
}));

import { GET } from '@/app/api/sitemap/route';

describe('GET /api/sitemap con más quizzes que max-rows', () => {
  it('pide páginas sucesivas y lista todos los quizzes publicados', async () => {
    const response = await GET();
    const xml = await response.text();

    const quizUrls =
      xml.match(/<loc>https:\/\/quizverse\.org\/(?:en|es)\/quiz\/[^<]+<\/loc>/g) ?? [];
    expect(quizUrls).toHaveLength(TOTAL);
    expect(new Set(quizUrls).size).toBe(TOTAL);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});
