/**
 * Tests de los constructores de URLs de `src/lib/seo/site.ts`.
 *
 * Todo lo que termina en un `<link rel="canonical">`, un `og:*` o un `@id` de
 * JSON-LD sale de estas funciones; un cambio aquí puede mandar a Google
 * canonicals o imágenes OG rotas sin que nada más lo detecte.
 */

import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  categoryOgImage,
  quizOgImage,
  resultOgImage,
  safePath,
  SITE_URL,
} from '@/lib/seo/site';

describe('absoluteUrl', () => {
  it('convierte un path con barra inicial en URL absoluta', () => {
    expect(absoluteUrl('/es/quiz/x')).toBe(`${SITE_URL}/es/quiz/x`);
  });

  it('antepone la barra si el path no la tiene', () => {
    expect(absoluteUrl('es/quiz/x')).toBe(`${SITE_URL}/es/quiz/x`);
  });

  it('devuelve intacta una URL que ya es absoluta (http y https)', () => {
    const https = 'https://otro.example/es/quiz/x';
    const http = 'http://otro.example/es/quiz/x';
    expect(absoluteUrl(https)).toBe(https);
    expect(absoluteUrl(http)).toBe(http);
  });

  it("'/' se resuelve al SITE_URL sin barra final", () => {
    expect(absoluteUrl('/')).toBe(SITE_URL);
    expect(absoluteUrl('/')).not.toMatch(/\/$/);
  });
});

describe('safePath', () => {
  it('codifica cada segmento y conserva la barra entre segmentos', () => {
    expect(safePath('a b', 'c/d')).toBe('a%20b/c%2Fd');
  });

  it('recorta barras iniciales y finales de cada segmento', () => {
    expect(safePath('/es/', '/quiz/')).toBe('es/quiz');
  });

  it('descarta segmentos vacíos o que quedan vacíos tras recortar', () => {
    expect(safePath('a', '', 'b')).toBe('a/b');
    expect(safePath('a', '/', 'b')).toBe('a/b');
  });

  it('codifica caracteres no ASCII para nunca emitir un path inválido', () => {
    expect(safePath('categoría')).toBe('categor%C3%ADa');
  });
});

describe('quizOgImage', () => {
  it('genera la URL absoluta de la OG dinámica del quiz', () => {
    expect(quizOgImage('es', 'trivia-de-chile')).toBe(
      `${SITE_URL}/es/quiz/trivia-de-chile/opengraph-image`
    );
  });

  it('percent-encodea el slug', () => {
    expect(quizOgImage('en', 'quiz raro')).toBe(`${SITE_URL}/en/quiz/quiz%20raro/opengraph-image`);
  });
});

describe('categoryOgImage', () => {
  it('genera la URL absoluta de la OG dinámica de la categoría', () => {
    expect(categoryOgImage('en', 'movies-tv')).toBe(
      `${SITE_URL}/en/category/movies-tv/opengraph-image`
    );
  });

  it('percent-encodea el slug', () => {
    expect(categoryOgImage('es', 'cine & tv')).toBe(
      `${SITE_URL}/es/category/cine%20%26%20tv/opengraph-image`
    );
  });
});

describe('resultOgImage', () => {
  it('sin tokens no emite query string', () => {
    expect(resultOgImage('es', 'x')).toBe(`${SITE_URL}/api/og/result/es/x`);
  });

  it('con share token emite `s`', () => {
    expect(resultOgImage('es', 'x', 'tok')).toBe(`${SITE_URL}/api/og/result/es/x?s=tok`);
  });

  it('con challenge token emite `s` y `c`', () => {
    expect(resultOgImage('es', 'x', 'tok', 'challenge')).toBe(
      `${SITE_URL}/api/og/result/es/x?s=tok&c=challenge`
    );
  });

  it('emite siempre una URL absoluta https sin dobles barras', () => {
    for (const url of [
      quizOgImage('es', 'trivia-de-chile'),
      categoryOgImage('en', 'movies-tv'),
      resultOgImage('es', 'x', 'tok'),
    ]) {
      expect(url.startsWith('https://')).toBe(true);
      expect(url.replace('https://', '')).not.toContain('//');
    }
  });
});
