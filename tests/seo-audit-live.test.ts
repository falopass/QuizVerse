/**
 * Tests herméticos del auditor SEO en vivo (`node scripts/seo/audit-live.mjs`).
 * Sin red: solo las funciones puras `parseSitemap`, `sampleUrls` y
 * `analyzePage` contra fixtures embebidos.
 */

import { describe, expect, it } from 'vitest';
import { analyzePage, parseSitemap, sampleUrls } from '../scripts/seo/audit-live.mjs';

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>https://quizverse.org/en</loc></url>
  <url><loc>https://quizverse.org/es</loc></url>
  <url>
    <loc>https://quizverse.org/en/category/movies-tv</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://quizverse.org/es/category/movies-tv"/>
  </url>
  <url><loc>https://quizverse.org/es/category/movies-tv</loc></url>
</urlset>`;

const QUIZ_URL = 'https://quizverse.org/en/quiz/space-trivia';

const page = (head: string) =>
  `<!doctype html><html><head>${head}</head><body><main>x</main></body></html>`;

const GOOD_HEAD = `
  <title>Space Trivia: test your NASA knowledge | QuizVerse</title>
  <meta name="description" content="Ten questions about planets, missions and the cosmos."/>
  <link rel="canonical" href="https://quizverse.org/en/quiz/space-trivia"/>
  <link rel="alternate" hreflang="en" href="https://quizverse.org/en/quiz/space-trivia"/>
  <link rel="alternate" hreflang="es" href="https://quizverse.org/es/quiz/trivia-espacial"/>
  <link rel="alternate" hreflang="x-default" href="https://quizverse.org/en/quiz/space-trivia"/>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Quiz","name":"Space Trivia"}</script>
`;

describe('parseSitemap', () => {
  it('extrae el <loc> de cada <url>', () => {
    expect(parseSitemap(SITEMAP_XML)).toEqual([
      'https://quizverse.org/en',
      'https://quizverse.org/es',
      'https://quizverse.org/en/category/movies-tv',
      'https://quizverse.org/es/category/movies-tv',
    ]);
  });

  it('devuelve [] para XML sin entradas', () => {
    expect(parseSitemap('<urlset></urlset>')).toEqual([]);
    expect(parseSitemap('')).toEqual([]);
  });
});

describe('sampleUrls', () => {
  const urls = [
    'https://quizverse.org/en',
    'https://quizverse.org/es',
    'https://quizverse.org/en/quiz',
    'https://quizverse.org/es/quiz',
    'https://quizverse.org/en/category/movies-tv',
    'https://quizverse.org/es/category/movies-tv',
    'https://quizverse.org/en/category/gaming',
    'https://quizverse.org/es/category/gaming',
    ...Array.from({ length: 10 }, (_, i) => `https://quizverse.org/en/quiz/quiz-${i}`),
    ...Array.from({ length: 10 }, (_, i) => `https://quizverse.org/es/quiz/test-${i}`),
  ];

  it('reparte la muestra entre idiomas y tipos de página', () => {
    const sample = sampleUrls(urls, 8);
    expect(sample).toHaveLength(8);
    expect(sample.some((u: string) => /\/en(\/|$)/.test(u))).toBe(true);
    expect(sample.some((u: string) => /\/es(\/|$)/.test(u))).toBe(true);
    expect(sample.some((u: string) => u.includes('/category/'))).toBe(true);
    expect(sample.some((u: string) => u.includes('/quiz/'))).toBe(true);
  });

  it('no repite URLs ni excede el total', () => {
    const all = sampleUrls(urls, 100);
    expect(all).toHaveLength(urls.length);
    expect(new Set(all).size).toBe(urls.length);
    expect(sampleUrls(urls, 0)).toEqual([]);
  });
});

describe('analyzePage', () => {
  it('aprueba una página correcta', () => {
    const result = analyzePage(page(GOOD_HEAD), QUIZ_URL, { status: 200 });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('marca canonical ausente', () => {
    const result = analyzePage(
      page(GOOD_HEAD.replace(/<link rel="canonical"[^>]*\/>/, '')),
      QUIZ_URL,
      { status: 200 }
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join('; ')).toContain('canonical ausente');
  });

  it('marca canonical cruzada', () => {
    const result = analyzePage(
      page(GOOD_HEAD.replace(QUIZ_URL, 'https://quizverse.org/en/quiz/other')),
      QUIZ_URL,
      { status: 200 }
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join('; ')).toContain('canonical cruzada');
  });

  it('marca JSON-LD inválido', () => {
    const result = analyzePage(page(GOOD_HEAD.replace('{"@context"', '{roto')), QUIZ_URL, {
      status: 200,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join('; ')).toContain('json-ld inválido');
  });

  it('marca JSON-LD ausente', () => {
    const result = analyzePage(
      page(GOOD_HEAD.replace(/<script type="application\/ld\+json">.*?<\/script>/, '')),
      QUIZ_URL,
      { status: 200 }
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join('; ')).toContain('json-ld ausente');
  });

  it('marca noindex inesperado', () => {
    const result = analyzePage(
      page(`${GOOD_HEAD}<meta name="robots" content="noindex"/>`),
      QUIZ_URL,
      { status: 200 }
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join('; ')).toContain('noindex');
  });

  it('reporta redirecciones con su destino y corta sin inspeccionar el HTML', () => {
    const result = analyzePage('', QUIZ_URL, {
      status: 301,
      location: 'https://quizverse.org/en',
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain('301');
    expect(result.failures[0]).toContain('https://quizverse.org/en');
  });
});
