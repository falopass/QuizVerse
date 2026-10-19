/**
 * Tests de la extensión de imágenes del sitemap (SEO-32):
 * - el serializador emite `image:image`/`image:loc`/`image:title` bien escapados
 * - el helper de ruta elige stock cover o procedural y devuelve URL absoluta
 */

import { describe, expect, it, vi } from 'vitest';
import { generateSitemapXml } from '@/lib/seo/sitemap';
import { SITE_URL } from '@/lib/seo/site';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => ({
          data: [
            {
              slug: 'quiz-stock',
              title: 'Quiz con stock',
              cover_image_url: '/stock-covers/movies-tv/quiz-stock.jpg',
              language: 'es',
              published_at: '2026-10-01T00:00:00Z',
              updated_at: null,
              quiz_type: 'trivia',
              category_id: 'movies-tv',
              category: { slug: 'movies-tv' },
            },
            {
              slug: 'quiz-procedural',
              title: 'Quiz procedural',
              cover_image_url: null,
              language: 'en',
              published_at: '2026-10-02T00:00:00Z',
              updated_at: null,
              quiz_type: 'trivia',
              category_id: 'gaming',
              category: { slug: 'gaming' },
            },
          ],
          error: null,
        }),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/data/quiz-locale-map', () => ({
  getEquivalentQuizSlug: () => null,
}));

import { GET, quizCoverImageUrl } from '@/app/api/sitemap/route';

const BASE = 'https://quizverse.org';

describe('generateSitemapXml — extensión de imágenes', () => {
  it('declara el namespace xmlns:image en el urlset', () => {
    const xml = generateSitemapXml([{ url: '/en/quiz/foo' }], BASE);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  it('emite image:image con loc y title para una entrada con una imagen', () => {
    const xml = generateSitemapXml(
      [
        {
          url: '/en/quiz/foo',
          images: [{ url: 'https://quizverse.org/covers/foo', title: 'Foo Quiz' }],
        },
      ],
      BASE
    );
    expect(xml).toContain(
      '<image:image><image:loc>https://quizverse.org/covers/foo</image:loc>' +
        '<image:title>Foo Quiz</image:title></image:image>'
    );
  });

  it('escapa & en la URL de la imagen', () => {
    const xml = generateSitemapXml(
      [
        {
          url: '/en/quiz/foo',
          images: [{ url: 'https://cdn.example.com/img?a=1&b=2' }],
        },
      ],
      BASE
    );
    expect(xml).toContain('<image:loc>https://cdn.example.com/img?a=1&amp;b=2</image:loc>');
  });

  it('no emite ninguna etiqueta image:* cuando la entrada no tiene imágenes', () => {
    const xml = generateSitemapXml([{ url: '/en/quiz/foo' }], BASE);
    expect(xml).not.toContain('<image:image>');
    expect(xml).not.toContain('<image:loc>');
  });
});

describe('quizCoverImageUrl', () => {
  it('usa la ruta stock cuando cover_image_url apunta a /stock-covers/', () => {
    const url = quizCoverImageUrl({
      slug: 'foo',
      cover_image_url: '/stock-covers/movies-tv/foo.jpg',
    });
    expect(url).toBe(`${SITE_URL}/stock-covers/movies-tv/foo.jpg`);
  });

  it('cae en la portada procedural /covers/[slug] sin stock cover', () => {
    expect(quizCoverImageUrl({ slug: 'foo', cover_image_url: null })).toBe(
      `${SITE_URL}/covers/foo`
    );
    expect(quizCoverImageUrl({ slug: 'foo', cover_image_url: '' })).toBe(
      `${SITE_URL}/covers/foo`
    );
    expect(quizCoverImageUrl({ slug: 'foo', cover_image_url: 'https://otro.example/x.png' })).toBe(
      `${SITE_URL}/covers/foo`
    );
  });

  it('devuelve URL absoluta y codifica el slug', () => {
    const url = quizCoverImageUrl({ slug: 'qué es', cover_image_url: null });
    expect(url).toBe(`${SITE_URL}/covers/qu%C3%A9%20es`);
  });
});

describe('GET /api/sitemap — imágenes', () => {
  it('emite un image:image por quiz con su portada absoluta', async () => {
    const xml = await (await GET()).text();
    expect(xml).toContain(
      `<image:loc>${SITE_URL}/stock-covers/movies-tv/quiz-stock.jpg</image:loc>`
    );
    expect(xml).toContain(`<image:loc>${SITE_URL}/covers/quiz-procedural</image:loc>`);
    expect(xml).toContain('<image:title>Quiz con stock</image:title>');
    // Solo los quizzes llevan imagen: una por ficha, ninguna en hubs ni editoriales.
    expect(xml.match(/<image:image>/g)).toHaveLength(2);
  });
});
