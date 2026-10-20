/**
 * SEO-40: un fallo de Supabase no debe publicar un sitemap de 14 URLs con
 * 200 (Google lo tomaría como el catálogo real y desindexaría). La ruta
 * responde 503 + Retry-After; un catálogo legítimamente vacío sigue siendo
 * un 200 normal.
 */

import { describe, expect, it, vi } from 'vitest';

type QueryResult = { data: unknown[] | null; error: unknown };

const state = vi.hoisted(() => ({
  result: { data: [], error: null } as QueryResult,
  throwOnFrom: false,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      if (state.throwOnFrom) throw new Error('connection refused');
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => state.result,
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: () => null,
}));

import { GET } from '@/app/api/sitemap/route';

const quizRows = [
  {
    slug: 'en-one',
    language: 'en',
    published_at: '2026-10-01T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
  {
    slug: 'es-one',
    language: 'es',
    published_at: '2026-10-02T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
];

describe('GET /api/sitemap — disponibilidad', () => {
  it('responde 503 con Retry-After cuando Supabase lanza', async () => {
    state.throwOnFrom = true;
    const response = await GET();
    state.throwOnFrom = false;

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('300');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).not.toContain('<urlset');
  });

  it('responde 503 cuando Supabase devuelve error', async () => {
    state.result = { data: null, error: { message: 'boom' } };
    const response = await GET();
    state.result = { data: [], error: null };

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('300');
  });

  it('responde 503 cuando Supabase devuelve data: null sin error', async () => {
    state.result = { data: null, error: null };
    const response = await GET();
    state.result = { data: [], error: null };

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('300');
  });

  it('un catálogo vacío legítimo sigue siendo 200 con las páginas editoriales', async () => {
    state.result = { data: [], error: null };
    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    // 10 páginas editoriales × 2 idiomas, sin quizzes ni hubs.
    expect(xml.match(/<loc>/g)).toHaveLength(20);
    expect(xml).toContain('<loc>https://quizverse.org/en</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/es/terms</loc>');
  });

  it('con filas publicadas el XML incluye los <loc> de esos quizzes', async () => {
    state.result = { data: quizRows, error: null };
    const response = await GET();
    const xml = await response.text();
    state.result = { data: [], error: null };

    expect(response.status).toBe(200);
    expect(xml).toContain('<loc>https://quizverse.org/en/quiz/en-one</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/es/quiz/es-one</loc>');
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}/);
  });
});
