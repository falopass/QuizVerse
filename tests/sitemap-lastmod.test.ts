/**
 * `lastmod` del sitemap: último cambio real de contenido por quiz y el máximo
 * de sus quizzes en los hubs. El `updated_at` que el import masivo escribe
 * igual a `created_at` no es una edición; sin fecha fiable la URL va sin
 * `<lastmod>`.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

const IMPORT_BATCH = '2026-09-27T01:46:57.251Z';
const BULK_EDIT = '2026-10-19T17:54:02.393Z';

const quizRows = [
  {
    slug: 'en-edited',
    language: 'en',
    published_at: '2026-10-01T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
  {
    slug: 'en-published',
    language: 'en',
    published_at: '2026-10-02T00:00:00Z',
    created_at: '2026-10-02T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
  {
    slug: 'en-undated',
    language: 'en',
    published_at: null,
    created_at: '2026-10-02T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
  // Import masivo: 50 fichas insertadas en una transacción, con su fecha real
  // de publicación y el `updated_at` igual a `created_at`.
  ...Array.from({ length: 50 }, (_, index) => ({
    slug: `en-batch-${index}`,
    language: 'en',
    published_at: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    created_at: IMPORT_BATCH,
    updated_at: IMPORT_BATCH,
    quiz_type: 'trivia',
    category_id: 'culture',
    category: { slug: 'culture' },
  })),
  // Lote de 50 ediciones auténticas: mismo `updated_at`, pero la fila ya
  // existía desde el import.
  ...Array.from({ length: 50 }, (_, index) => ({
    slug: `en-retitled-${index}`,
    language: 'en',
    published_at: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    created_at: IMPORT_BATCH,
    updated_at: BULK_EDIT,
    quiz_type: 'trivia',
    category_id: 'music',
    category: { slug: 'music' },
  })),
];

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: async (from: number) => ({ data: from > 0 ? [] : quizRows, error: null }),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: () => null,
}));

import { GET } from '@/app/api/sitemap/route';

function urlBlock(xml: string, loc: string): string | undefined {
  const match = xml.match(
    new RegExp(`<url>(?:(?!</url>).)*?<loc>${loc}</loc>(?:(?!</url>).)*?</url>`, 's')
  );
  return match?.[0];
}

let xml: string;

describe('GET /api/sitemap — lastmod por contenido', () => {
  beforeAll(async () => {
    const response = await GET();
    xml = await response.text();
  });

  it('usa la edición posterior a la publicación', () => {
    const block = urlBlock(xml, 'https://quizverse.org/en/quiz/en-edited');
    expect(block).toContain('<lastmod>2026-10-20T00:00:00.000Z</lastmod>');
  });

  it('sin edición usa la fecha de publicación', () => {
    const block = urlBlock(xml, 'https://quizverse.org/en/quiz/en-published');
    expect(block).toContain('<lastmod>2026-10-02T00:00:00.000Z</lastmod>');
  });

  it('omite lastmod cuando no hay fecha fiable', () => {
    const block = urlBlock(xml, 'https://quizverse.org/en/quiz/en-undated');
    expect(block).toBeDefined();
    expect(block).not.toContain('<lastmod>');
  });

  it('ignora el timestamp del import masivo y usa el published_at de cada ficha', () => {
    const block = urlBlock(xml, 'https://quizverse.org/en/quiz/en-batch-0');
    expect(block).toContain('<lastmod>2026-05-01T00:00:00.000Z</lastmod>');
    expect(block).not.toContain(IMPORT_BATCH);
  });

  it('conserva la fecha de un lote de 50 ediciones reales', () => {
    const block = urlBlock(xml, 'https://quizverse.org/en/quiz/en-retitled-0');
    expect(block).toContain(`<lastmod>${new Date(BULK_EDIT).toISOString()}</lastmod>`);

    const hub = urlBlock(xml, 'https://quizverse.org/en/category/music');
    expect(hub).toContain(`<lastmod>${new Date(BULK_EDIT).toISOString()}</lastmod>`);
  });

  it('el hub toma el máximo de sus quizzes, no el timestamp del import', () => {
    const gaming = urlBlock(xml, 'https://quizverse.org/en/category/gaming');
    expect(gaming).toContain('<lastmod>2026-10-20T00:00:00.000Z</lastmod>');

    const culture = urlBlock(xml, 'https://quizverse.org/en/category/culture');
    expect(culture).toContain('<lastmod>2026-05-28T00:00:00.000Z</lastmod>');
    expect(culture).not.toContain(IMPORT_BATCH);
  });

  it('la portada usa el último cambio de contenido del locale', () => {
    const home = urlBlock(xml, 'https://quizverse.org/en');
    expect(home).toContain('<lastmod>2026-10-20T00:00:00.000Z</lastmod>');
  });
});
