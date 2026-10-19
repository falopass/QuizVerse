/**
 * Test de integración del route handler `GET /api/sitemap` (servido en
 * /sitemap.xml). Los helpers ya tienen tests unitarios; aquí se fija el
 * contrato completo de la respuesta: URLs por locale, hubs de tipo/categoría,
 * alternates solo cuando la pareja existe y cabeceras.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

const quizRows = [
  {
    slug: 'es-quiz-solo',
    language: 'es',
    published_at: '2026-10-01T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'movies-tv',
    category: { slug: 'movies-tv' },
  },
  {
    slug: 'en-pair',
    language: 'en',
    published_at: '2026-10-02T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
  {
    slug: 'es-pair',
    language: 'es',
    published_at: '2026-10-02T00:00:00Z',
    updated_at: null,
    quiz_type: 'trivia',
    category_id: 'gaming',
    category: { slug: 'gaming' },
  },
  {
    slug: 'en-persona',
    language: 'en',
    published_at: '2026-10-03T00:00:00Z',
    updated_at: '2026-10-04T00:00:00Z',
    quiz_type: 'personality',
    category_id: null,
    category: null,
  },
];

const PAIRS: Record<string, string> = {
  'en-pair': 'es-pair',
  'es-pair': 'en-pair',
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => ({ data: quizRows, error: null }),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: (slug: string) => PAIRS[slug] ?? null,
}));

import { GET } from '@/app/api/sitemap/route';

function urlBlock(xml: string, loc: string): string | undefined {
  const match = xml.match(
    new RegExp(`<url>(?:(?!</url>).)*?<loc>${loc}</loc>(?:(?!</url>).)*?</url>`, 's')
  );
  return match?.[0];
}

let xml: string;
let response: Awaited<ReturnType<typeof GET>>;

describe('GET /api/sitemap', () => {
  beforeAll(async () => {
    response = await GET();
    xml = await response.text();
  });

  it('responde XML con cabeceras de sitemap', () => {
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(xml).toContain('<urlset');
  });

  it('lista las páginas editoriales en ambos locales', () => {
    for (const path of ['/quiz', '/about', '/contact', '/privacy', '/terms', '/leaderboard']) {
      expect(xml).toContain(`<loc>https://quizverse.org/en${path}</loc>`);
      expect(xml).toContain(`<loc>https://quizverse.org/es${path}</loc>`);
    }
    expect(xml).toContain('<loc>https://quizverse.org/en</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/es</loc>');
  });

  it('lista cada quiz publicado solo en su propio idioma', () => {
    expect(xml).toContain('<loc>https://quizverse.org/es/quiz/es-quiz-solo</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/en/quiz/en-pair</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/es/quiz/es-pair</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/en/quiz/en-persona</loc>');
    expect(xml).not.toContain('/en/quiz/es-quiz-solo');
    expect(xml).not.toContain('/es/quiz/en-pair');
  });

  it('emite el hub de tipo solo en el locale que tiene quizzes de ese tipo', () => {
    expect(xml).toContain('<loc>https://quizverse.org/en/category/personality</loc>');
    expect(xml).not.toContain('/es/category/personality');
    expect(xml).toContain('<loc>https://quizverse.org/en/category/trivia</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/es/category/trivia</loc>');
  });

  it('emite el hub de categoría solo en el locale que la tiene publicada', () => {
    expect(xml).toContain('<loc>https://quizverse.org/es/category/movies-tv</loc>');
    expect(xml).not.toContain('/en/category/movies-tv');
    expect(xml).toContain('<loc>https://quizverse.org/en/category/gaming</loc>');
    expect(xml).toContain('<loc>https://quizverse.org/es/category/gaming</loc>');
  });

  it('declara alternates xhtml solo en el quiz con pareja real', () => {
    const paired = urlBlock(xml, 'https://quizverse.org/en/quiz/en-pair');
    expect(paired).toContain('xhtml:link');
    expect(paired).toContain('hreflang="es" href="https://quizverse.org/es/quiz/es-pair"');
    expect(paired).toContain('hreflang="x-default"');

    const solo = urlBlock(xml, 'https://quizverse.org/es/quiz/es-quiz-solo');
    expect(solo).toBeDefined();
    expect(solo).not.toContain('xhtml:link');
  });

  it('no declara alternates en hubs de un solo idioma y sí en los bilingües', () => {
    const single = urlBlock(xml, 'https://quizverse.org/en/category/personality');
    expect(single).not.toContain('xhtml:link');

    const bilingual = urlBlock(xml, 'https://quizverse.org/en/category/gaming');
    expect(bilingual).toContain('xhtml:link');
    expect(bilingual).toContain('hreflang="es" href="https://quizverse.org/es/category/gaming"');
  });

  it('no incluye rutas no indexables ni duplicados', () => {
    expect(xml).not.toContain('/api/');
    expect(xml).not.toContain('/play');
    expect(xml).not.toContain('/result');
    expect(xml).not.toContain('/create');

    const locs = xml.match(/<loc>/g) ?? [];
    const unique = new Set(xml.match(/<loc>([^<]+)<\/loc>/g));
    expect(locs).toHaveLength(unique.size);
  });
});
