/**
 * El índice del explorador precalcula el texto normalizado una vez por quiz
 * (título, descripción, categoría localizada y tags) y el filtro hace un solo
 * `includes` por quiz. Estos tests fijan la misma semántica que tenía el
 * filtro inline — con la categoría como campo nuevo — para que precalcular
 * no cambie qué encuentra el buscador.
 */

import { describe, expect, it } from 'vitest';
import {
  foldSearchText,
  matchesSearchIndex,
  normalizeSearchTerm,
  searchIndexText,
  searchQueryTerms,
} from '@/lib/catalog/search-index';

describe('foldSearchText', () => {
  it('minúsculas y sin acentos, preservando la ñ', () => {
    expect(foldSearchText('  El Año Del Niño — ¡SÚPER!  ')).toBe('  el año del niño — ¡super!  ');
    expect(foldSearchText('Álvaro Niño émigré')).toBe('alvaro niño emigre');
  });

  it('la ñ no es una n con acento: «nino» no encuentra «niño»', () => {
    // El fold restaura ñ → ñ antes de quitar diacríticos, igual que siempre.
    expect(foldSearchText('niño')).toBe('niño');
    expect(matchesSearchIndex(foldSearchText('El niño que vivió'), foldSearchText('nino'))).toBe(
      false
    );
    expect(matchesSearchIndex(foldSearchText('El niño que vivió'), foldSearchText('niño'))).toBe(
      true
    );
  });
});

describe('searchIndexText', () => {
  const quiz = {
    title: 'Which Slytherin are you?',
    description: 'A Hogwarts personality read.',
    tags: ['harry potter', 'casa'],
    category: { name: 'Cine y televisión' },
  };

  it('encuentra título, descripción y tags como antes', () => {
    const index = searchIndexText(quiz);
    expect(matchesSearchIndex(index, foldSearchText('slytherin'))).toBe(true);
    expect(matchesSearchIndex(index, foldSearchText('hogwarts'))).toBe(true);
    expect(matchesSearchIndex(index, foldSearchText('POTTER'))).toBe(true);
  });

  it('la búsqueda ignora acentos y mayúsculas en ambos lados', () => {
    const index = searchIndexText({ ...quiz, title: 'Canción de hielo' });
    expect(matchesSearchIndex(index, foldSearchText('CANCION'))).toBe(true);
    expect(matchesSearchIndex(index, foldSearchText('canción'))).toBe(true);
  });

  it('también busca por el nombre de la categoría ya localizado', () => {
    const index = searchIndexText(quiz);
    expect(matchesSearchIndex(index, foldSearchText('cine'))).toBe(true);
    expect(matchesSearchIndex(index, foldSearchText('televisión'))).toBe(true);
  });

  it('sin campos opcionales el índice sigue funcionando', () => {
    const index = searchIndexText({ title: 'Solo título' });
    expect(matchesSearchIndex(index, foldSearchText('solo'))).toBe(true);
    expect(matchesSearchIndex(index, foldSearchText('descripción'))).toBe(false);
  });

  it('una consulta no cruza el límite entre campos', () => {
    // "tv? A" mezcla el final del título con el inicio de la descripción:
    // el filtro viejo (campo a campo) no lo encontraba y el índice tampoco.
    const index = searchIndexText(quiz);
    expect(matchesSearchIndex(index, foldSearchText('you? a hogwarts'))).toBe(false);
  });

  it('reproduce el filtro anterior sobre un catálogo de ejemplo', () => {
    const quizzes = [
      {
        title: 'Marvel o DC',
        description: 'Elige tu bando.',
        tags: ['superhéroes'],
        category: { name: 'Movies & TV' },
      },
      {
        title: 'Tu casa de Hogwarts',
        description: null,
        tags: ['harry potter'],
        category: { name: 'Personalidad' },
      },
      { title: 'Nintendogs', description: 'Guau.', tags: [], category: null },
    ];
    // Réplica del filtro inline que había en explore-editorial-page.
    const legacy = (q: (typeof quizzes)[number], normalizedQuery: string) =>
      foldSearchText(q.title).includes(normalizedQuery) ||
      foldSearchText(q.description ?? '').includes(normalizedQuery) ||
      q.tags.some((tag) => foldSearchText(tag).includes(normalizedQuery));

    for (const rawQuery of ['marvel', 'hogwarts', 'superhéroes', 'bando', 'guau', 'zzz']) {
      const normalizedQuery = foldSearchText(rawQuery);
      for (const quiz of quizzes) {
        expect(matchesSearchIndex(searchIndexText(quiz), normalizedQuery)).toBe(
          legacy(quiz, normalizedQuery)
        );
      }
    }
  });
});

describe('normalizeSearchTerm y searchQueryTerms (paridad local/remota)', () => {
  it('descarta términos vacíos o compuestos solo por diacríticos', () => {
    expect(normalizeSearchTerm('   ')).toBe('');
    expect(normalizeSearchTerm('\u0301\u0308')).toBe('');
    expect(searchQueryTerms('   ')).toEqual([]);
    expect(searchQueryTerms('\u0301')).toEqual([]);
  });

  it('preserva la ñ precompuesta y recompone n + tilde combinante (NFD)', () => {
    expect(normalizeSearchTerm('año')).toBe('año');
    expect(searchQueryTerms('año')).toEqual(['año']);
  });

  it('devuelve término NFC y variante plegada cuando hay tildes que foldSearchText quita', () => {
    expect(searchQueryTerms('Música')).toEqual(['Música', 'musica']);
    expect(searchQueryTerms('Películas')).toEqual(['Películas', 'peliculas']);
    expect(searchQueryTerms('star wars')).toEqual(['star wars']);
  });
});
