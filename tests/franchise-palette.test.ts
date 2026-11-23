/**
 * La paleta por franquicia (categoría) tiñe la tarjeta con `--qv-accent`,
 * `--qv-accent-soft` y `--qv-on-accent`. Dos garantías del mapa: slug
 * desconocido o ausente cae al acento actual (sin variables), y cada tinta
 * `onAccent` mantiene contraste AA (≥ 4.5) sobre su acento.
 */

import { describe, expect, it } from 'vitest';
import {
  accentForCategory,
  contrastRatio,
  coverArtSpec,
  coverGlyph,
  coverMotifMarkup,
  type FranchiseAccent,
} from '@/lib/design/franchise-palette';

const KNOWN_SLUGS = [
  'trivia',
  'personality',
  'culture',
  'lifestyle',
  'movies-tv',
  'anime-manga',
  'gaming',
  'music',
  'literature',
  'pop-culture',
  'technology',
  'relationships',
  'food-drink',
  'science',
  'animals',
  'sports',
  'geography',
  'history',
];

describe('accentForCategory', () => {
  it('devuelve acento para cada categoría del catálogo', () => {
    for (const slug of KNOWN_SLUGS) {
      const accent: FranchiseAccent | undefined = accentForCategory(slug);
      expect(accent, slug).toBeDefined();
      expect(accent!.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(accent!.soft.startsWith(accent!.accent)).toBe(true);
    }
  });

  it.each([undefined, null, '', 'categoria-inexistente'])(
    'slug %j no pinta: fallback al acento actual',
    (slug) => {
      expect(accentForCategory(slug)).toBeUndefined();
    }
  );

  it('toda tinta onAccent tiene contraste AA sobre su acento', () => {
    for (const slug of KNOWN_SLUGS) {
      const accent = accentForCategory(slug)!;
      expect(contrastRatio(accent.onAccent, accent.accent), slug).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('coverArtSpec / coverMotifMarkup (arte propio L8)', () => {
  const input = (slug: string, categorySlug: string | null = 'music') => ({
    slug,
    title: 'Trivia de rock',
    quizType: 'trivia',
    categorySlug,
  });

  it('el motivo sale de la categoría y, sin categoría, del tipo', () => {
    expect(coverArtSpec(input('a', 'music')).motif).toBe('bars');
    expect(coverArtSpec(input('a', 'movies-tv')).motif).toBe('film');
    expect(coverArtSpec(input('a', null)).motif).toBe('tiles');
    expect(coverArtSpec({ ...input('a', null), quizType: 'personality' }).motif).toBe('burst');
  });

  it('el acento es el de la categoría y el segundo color nunca lo repite', () => {
    for (const slug of KNOWN_SLUGS) {
      for (let i = 0; i < 12; i++) {
        const spec = coverArtSpec(input(`s-${slug}-${i}`, slug));
        expect(spec.accent).toBe(accentForCategory(slug)!.accent);
        expect(spec.second.toLowerCase()).not.toBe(spec.accent.toLowerCase());
      }
    }
  });

  it('pleno: la tinta mantiene AA sobre el campo (título impreso en el hero)', () => {
    for (const slug of KNOWN_SLUGS) {
      const spec = coverArtSpec(input(`x-${slug}`, slug), 'pleno');
      expect(contrastRatio(spec.ink, spec.field), slug).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('es determinista y varía por slug', () => {
    const a = coverMotifMarkup(coverArtSpec(input('es-rock')));
    expect(coverMotifMarkup(coverArtSpec(input('es-rock')))).toBe(a);
    expect(coverMotifMarkup(coverArtSpec(input('en-rock')))).not.toBe(a);
  });

  it('presupuesto: el arte en línea pesa menos de 2,5 KB por tarjeta', () => {
    for (const slug of KNOWN_SLUGS) {
      for (let i = 0; i < 25; i++) {
        const markup = coverMotifMarkup(coverArtSpec(input(`b-${slug}-${i}`, slug)));
        expect(markup.length, `${slug}#${i}`).toBeLessThan(2500);
      }
    }
  });

  it('solo números y colores: ni texto ni atributos de evento', () => {
    for (const slug of KNOWN_SLUGS) {
      const markup = coverMotifMarkup(coverArtSpec(input(`t-${slug}`, slug)));
      expect(markup).not.toMatch(/<text|<script|on[a-z]+=|href/i);
    }
  });

  it('coverGlyph: inicial de la primera palabra con peso, en mayúscula', () => {
    expect(coverGlyph('¿Qué personaje eres?')).toBe('P');
    expect(coverGlyph('Which Stranger Things character are you?')).toBe('S');
    expect(coverGlyph('«Ñandú» y amigos')).toBe('Ñ');
    expect(coverGlyph('2026 en 10 preguntas')).toBe('2');
    expect(coverGlyph('¿Qué?')).toBe('Q');
    expect(coverGlyph('¿¡!?')).toBe('?');
  });
});

describe('contrastRatio', () => {
  it('negro sobre blanco da el máximo (21) y un color consigo mismo da 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#d9ff43', '#d9ff43')).toBe(1);
  });
});
