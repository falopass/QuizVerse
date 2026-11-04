/**
 * Tests de los hubs de fandom en `GET /api/sitemap` (/sitemap.xml).
 *
 * Cada `/{locale}/fandom/{slug}` entra al sitemap solo cuando su franquicia
 * tiene ≥3 quizzes publicados en ese idioma; `lastmod` es el último cambio de
 * sus miembros y los `alternates` solo aparecen cuando la votación del mapa de
 * quizzes empareja el hub del otro idioma («merlina» ↔ «wednesday»).
 */

import { describe, expect, it, vi } from 'vitest';

function row(
  slug: string,
  title: string,
  language: 'en' | 'es',
  published_at: string,
  updated_at: string | null = null
) {
  return {
    slug,
    title,
    cover_image_url: null,
    language,
    published_at,
    created_at: published_at,
    updated_at,
    quiz_type: 'trivia',
    category_id: 'anime-manga',
    category: { slug: 'anime-manga' },
  };
}

const quizRows = [
  // Wednesday (en) ↔ Merlina (es): misma franquicia, nombres distintos.
  row('en-wednesday-fan', 'Wednesday Fan Trivia Challenge', 'en', '2026-10-01T00:00:00Z'),
  row(
    'en-wednesday-role',
    'What role would you play inside Wednesday?',
    'en',
    '2026-10-02T00:00:00Z'
  ),
  row(
    'en-wednesday-energy',
    'Which Wednesday energy matches you best?',
    'en',
    '2026-10-05T00:00:00Z'
  ),
  row(
    'en-wednesday-deep',
    'How deep does your Wednesday knowledge go?',
    'en',
    '2026-10-03T00:00:00Z'
  ),
  row('es-merlina-fan', 'Trivia fan de Merlina', 'es', '2026-10-01T00:00:00Z'),
  row('es-merlina-rol', '¿Qué rol jugarías dentro de Merlina?', 'es', '2026-10-06T00:00:00Z'),
  row(
    'es-merlina-energia',
    '¿Qué energía de Merlina combina mejor contigo?',
    'es',
    '2026-10-04T00:00:00Z'
  ),
  // Solo en inglés y sin par en el mapa: hub sin alternates.
  row('en-dune-fan', 'Dune Fan Trivia Challenge', 'en', '2026-10-02T00:00:00Z'),
  row('en-dune-role', 'What role would you play inside Dune?', 'en', '2026-10-02T00:00:00Z'),
  row('en-dune-energy', 'Which Dune energy matches you best?', 'en', '2026-10-02T00:00:00Z'),
  // Dos quizzes no hacen hub.
  row('es-dune-fan', 'Trivia fan de Dune', 'es', '2026-10-02T00:00:00Z'),
  row('es-dune-rol', '¿Qué rol jugarías dentro de Dune?', 'es', '2026-10-02T00:00:00Z'),
  // Título sin plantilla de franquicia: no agrupa.
  row(
    'es-trivia-aves',
    'Trivia de animales: ¿cuánto sabes de las aves?',
    'es',
    '2026-10-02T00:00:00Z'
  ),
];

const PAIRS: Record<string, string> = {
  'en-wednesday-fan': 'es-merlina-fan',
  'en-wednesday-role': 'es-merlina-rol',
  'en-wednesday-energy': 'es-merlina-energia',
  'en-wednesday-deep': 'es-merlina-rol',
  'es-merlina-fan': 'en-wednesday-fan',
  'es-merlina-rol': 'en-wednesday-role',
  'es-merlina-energia': 'en-wednesday-energy',
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: async (from: number, to: number) => ({
          data: quizRows.slice(from, to + 1),
          error: null,
        }),
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
  return xml.match(
    new RegExp(`<url>(?:(?!</url>).)*?<loc>${loc}</loc>(?:(?!</url>).)*?</url>`, 's')
  )?.[0];
}

async function xml() {
  const response = await GET();
  expect(response.status).toBe(200);
  return response.text();
}

describe('sitemap · hubs de fandom', () => {
  it('incluye cada hub con ≥3 quizzes en su idioma', async () => {
    const body = await xml();
    expect(body).toContain('<loc>https://quizverse.org/en/fandom/wednesday</loc>');
    expect(body).toContain('<loc>https://quizverse.org/es/fandom/merlina</loc>');
    expect(body).toContain('<loc>https://quizverse.org/en/fandom/dune</loc>');
  });

  it('omite la franquicia que no llega a 3 en ese idioma', async () => {
    const body = await xml();
    expect(body).not.toContain('/es/fandom/dune');
    expect(body).not.toContain('/en/fandom/merlina');
    expect(body).not.toContain('/fandom/animales');
  });

  it('lastmod es el cambio más reciente de sus quizzes', async () => {
    const body = await xml();
    const en = urlBlock(body, 'https://quizverse.org/en/fandom/wednesday');
    expect(en).toContain('<lastmod>2026-10-05T00:00:00.000Z</lastmod>');
    const es = urlBlock(body, 'https://quizverse.org/es/fandom/merlina');
    expect(es).toContain('<lastmod>2026-10-06T00:00:00.000Z</lastmod>');
  });

  it('declara alternates cuando la pareja existe en el otro idioma', async () => {
    const body = await xml();
    const en = urlBlock(body, 'https://quizverse.org/en/fandom/wednesday');
    expect(en).toContain('hreflang="es"');
    expect(en).toContain('href="https://quizverse.org/es/fandom/merlina"');
    expect(en).toContain('hreflang="x-default"');
    const es = urlBlock(body, 'https://quizverse.org/es/fandom/merlina');
    expect(es).toContain('href="https://quizverse.org/en/fandom/wednesday"');
  });

  it('sin pareja no emite xhtml:link', async () => {
    const body = await xml();
    const en = urlBlock(body, 'https://quizverse.org/en/fandom/dune');
    expect(en).toBeDefined();
    expect(en).not.toContain('xhtml:link');
  });
});
