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

describe('contrastRatio', () => {
  it('negro sobre blanco da el máximo (21) y un color consigo mismo da 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#d9ff43', '#d9ff43')).toBe(1);
  });
});
