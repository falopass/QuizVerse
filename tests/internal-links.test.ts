/**
 * Tests herméticos del auditor de enlaces internos
 * (`node scripts/seo/internal-links.mjs`). Sin red: solo las funciones puras
 * `parseSitemap`, `extractInternalLinks` y `buildReport` contra fixtures
 * embebidos.
 */

import { describe, expect, it } from 'vitest';
import { buildReport, extractInternalLinks, parseSitemap } from '../scripts/seo/internal-links.mjs';

const SITE = 'https://quizverse.org';

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;

describe('parseSitemap', () => {
  it('extrae <loc> absolutos, decodifica entidades y deduplica', () => {
    const xml = `<urlset>
      <url><loc>https://quizverse.org/en</loc></url>
      <url><loc> https://quizverse.org/es?x=1&amp;y=2 </loc></url>
      <url><loc>https://quizverse.org/en</loc></url>
      <url><loc>/relativa</loc></url>
    </urlset>`;
    expect(parseSitemap(xml)).toEqual([
      'https://quizverse.org/en',
      'https://quizverse.org/es?x=1&y=2',
    ]);
  });
});

describe('extractInternalLinks', () => {
  it('normaliza absolutos y relativos: sin query, sin hash y sin barra final', () => {
    const links = extractInternalLinks(
      page(`
        <a href="${SITE}/en/quiz/geo?utm_source=x#hero">a</a>
        <a href="quiz/historia">b</a>
        <a href="/es/">c</a>
        <a href='/en/category/gaming'>d</a>
        <a href="//quizverse.org/en/about">e</a>
        <a href="${SITE}/en/quiz/geo">duplicado</a>
      `),
      `${SITE}/en/`,
      SITE
    );
    expect(links).toEqual([
      `${SITE}/en/quiz/geo`,
      `${SITE}/en/quiz/historia`,
      `${SITE}/es`,
      `${SITE}/en/category/gaming`,
      `${SITE}/en/about`,
    ]);
  });

  it('descarta mailto, tel, javascript, anclas, externos, /api/ y href rotos', () => {
    const links = extractInternalLinks(
      page(`
        <a href="mailto:hola@quizverse.org">mail</a>
        <a href="tel:+56912345678">tel</a>
        <a href="javascript:void(0)">js</a>
        <a href="#seccion">ancla</a>
        <a href="https://otro-dominio.com/en">externo</a>
        <a href="https://www.quizverse.org/en">subdominio</a>
        <a href="/api/quiz/reveal">api</a>
        <a href="http://[roto">roto</a>
        <a href="">vacío</a>
        <a>sin href</a>
      `),
      `${SITE}/en`,
      SITE
    );
    expect(links).toEqual([]);
  });
});

describe('buildReport', () => {
  const pages = [
    {
      url: `${SITE}/en`,
      html: page('<a href="/en/quiz">quiz</a><a href="/es">es</a>'),
    },
    {
      url: `${SITE}/en/quiz`,
      html: page('<a href="/en">inicio</a><a href="/en">dup</a><a href="/en/quiz">self</a>'),
    },
    { url: `${SITE}/es`, html: page('<a href="/en">home-en</a>') },
    { url: `${SITE}/es/orfana`, html: page('<a href="/es">home</a>') },
  ];

  it('cuenta entrantes por página distinta y marca huérfana solo la que nadie enlaza', () => {
    const report = buildReport(pages, SITE);
    expect(report.orphans).toEqual(['/es/orfana']);
    expect(report.singleInbound).toEqual([{ path: '/en/quiz', from: '/en' }]);
    expect(report.topLinked[0]).toEqual({ path: '/en', count: 2 });
    expect(report.topLinked[1]).toEqual({ path: '/es', count: 2 });
    expect(report.total).toBe(4);
  });

  it('resuelve hrefs relativos contra baseUrl (la URL final tras redirect), no la clave normalizada', () => {
    const report = buildReport(
      [
        // /en redirige a /en/: "quiz" debe resolver a /en/quiz como en el navegador
        { url: `${SITE}/en`, baseUrl: `${SITE}/en/`, html: page('<a href="quiz">q</a>') },
        { url: `${SITE}/en/quiz`, html: page('') },
      ],
      SITE
    );
    expect(report.singleInbound).toEqual([{ path: '/en/quiz', from: '/en' }]);
    expect(report.orphans).toEqual(['/en']);
  });

  it('reporta sub-sitemaps fallidos como errores del informe, fuera del grafo', () => {
    const report = buildReport([{ url: `${SITE}/en`, html: page('') }], SITE, [
      { url: `${SITE}/sitemap-b.xml`, error: 'HTTP 503' },
    ]);
    expect(report.errorCount).toBe(1);
    expect(report.errors).toEqual([{ path: '/sitemap-b.xml', error: 'HTTP 503' }]);
  });

  it('cuenta las páginas fallidas como errors y sigue el informe', () => {
    const report = buildReport(
      [
        { url: `${SITE}/en`, html: page('<a href="/en/rota">rota</a>') },
        { url: `${SITE}/en/rota`, error: 'HTTP 500' },
      ],
      SITE
    );
    expect(report.errorCount).toBe(1);
    expect(report.errors).toEqual([{ path: '/en/rota', error: 'HTTP 500' }]);
    // /en/rota sí recibió el enlace; la huérfana es /en
    expect(report.orphans).toEqual(['/en']);
  });

  it('cuenta enlaces a URLs internas que no están en el sitemap', () => {
    const report = buildReport(
      [{ url: `${SITE}/en`, html: page('<a href="/en/no-listada">x</a>') }],
      SITE
    );
    expect(report.linksOutsideSitemap).toBe(1);
    expect(report.orphans).toEqual(['/en']);
  });
});
