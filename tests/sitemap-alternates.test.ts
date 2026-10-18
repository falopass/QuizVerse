/**
 * Tests del fix del PR #10 (revisión Codex, P2).
 *
 * El bug: los alternates de categoría se emitían siempre, pero una categoría con
 * quizzes en un solo idioma no tiene página en el otro (`notFound()`), así que el
 * sitemap anunciaba un 404. Estas pruebas fijan el contrato: sin pareja
 * publicada, no hay hreflang.
 */

import { describe, expect, it } from 'vitest';
import {
  hubAlternates,
  quizAlternates,
  sharedPathAlternates,
  type SlugIndex,
} from '@/lib/seo/sitemap-alternates';
import { generateSitemapXml } from '@/lib/seo/sitemap';
import { SITE_URL } from '@/lib/seo/site';

function index(entries: Record<'en' | 'es', string[]>): SlugIndex {
  return new Map([
    ['en', new Set(entries.en)],
    ['es', new Set(entries.es)],
  ]);
}

describe('hubAlternates', () => {
  it('emite las tres variantes cuando el hub existe en ambos idiomas', () => {
    const hubs = index({ en: ['movies-tv'], es: ['movies-tv'] });

    expect(hubAlternates('en', 'movies-tv', hubs)).toEqual([
      { hreflang: 'en', href: '/en/category/movies-tv' },
      { hreflang: 'es', href: '/es/category/movies-tv' },
      { hreflang: 'x-default', href: '/en/category/movies-tv' },
    ]);
  });

  it('no emite nada si el hub solo tiene quizzes en inglés', () => {
    const hubs = index({ en: ['sports'], es: [] });
    expect(hubAlternates('en', 'sports', hubs)).toBeUndefined();
  });

  it('no emite nada si el hub solo tiene quizzes en español', () => {
    const hubs = index({ en: [], es: ['food-drink'] });
    expect(hubAlternates('es', 'food-drink', hubs)).toBeUndefined();
  });

  it('x-default apunta al inglés cuando existen los dos', () => {
    const hubs = index({ en: ['gaming'], es: ['gaming'] });
    const alternates = hubAlternates('es', 'gaming', hubs);

    expect(alternates?.find((item) => item.hreflang === 'x-default')?.href).toBe(
      '/en/category/gaming'
    );
  });

  it('no emite nada para un slug que no está publicado en el propio idioma', () => {
    const hubs = index({ en: ['gaming'], es: ['gaming'] });
    expect(hubAlternates('en', 'history', hubs)).toBeUndefined();
  });
});

describe('quizAlternates', () => {
  const published = index({ en: ['en-oppenheimer'], es: ['es-oppenheimer'] });

  it('emite el par cuando la traducción está publicada', () => {
    expect(quizAlternates('en', 'en-oppenheimer', 'es-oppenheimer', published)).toEqual([
      { hreflang: 'en', href: '/en/quiz/en-oppenheimer' },
      { hreflang: 'es', href: '/es/quiz/es-oppenheimer' },
      { hreflang: 'x-default', href: '/en/quiz/en-oppenheimer' },
    ]);
  });

  it('no emite nada si el mapa de traducciones no conoce la pareja', () => {
    expect(quizAlternates('en', 'en-oppenheimer', null, published)).toBeUndefined();
  });

  it('no emite nada si la pareja figura en el mapa pero no está publicada', () => {
    const stale = index({ en: ['en-oppenheimer'], es: [] });
    expect(quizAlternates('en', 'en-oppenheimer', 'es-oppenheimer', stale)).toBeUndefined();
  });

  it('escapa slugs con caracteres especiales', () => {
    const withOddSlug = index({ en: ['a'], es: ['b c'] });
    expect(quizAlternates('en', 'a', 'b c', withOddSlug)?.[1].href).toBe('/es/quiz/b%20c');
  });
});

describe('sharedPathAlternates', () => {
  it('declara en, es y x-default para las páginas editoriales', () => {
    expect(sharedPathAlternates('/about')).toEqual([
      { hreflang: 'en', href: '/en/about' },
      { hreflang: 'es', href: '/es/about' },
      { hreflang: 'x-default', href: '/en/about' },
    ]);
  });

  it('acepta la raíz sin barra doble', () => {
    expect(sharedPathAlternates('')[0].href).toBe('/en');
  });
});

describe('integración con el serializador del sitemap', () => {
  it('un hub de un solo idioma no produce xhtml:link en el XML', () => {
    const hubs = index({ en: ['sports'], es: [] });
    const xml = generateSitemapXml(
      [{ url: '/en/category/sports', alternates: hubAlternates('en', 'sports', hubs) }],
      SITE_URL
    );

    expect(xml).toContain('<loc>https://quizverse.org/en/category/sports</loc>');
    expect(xml).not.toContain('xhtml:link');
  });

  it('un hub bilingüe sí los produce', () => {
    const hubs = index({ en: ['sports'], es: ['sports'] });
    const xml = generateSitemapXml(
      [{ url: '/en/category/sports', alternates: hubAlternates('en', 'sports', hubs) }],
      SITE_URL
    );

    expect(xml.match(/xhtml:link/g)).toHaveLength(3);
  });
});
