import { describe, expect, it } from 'vitest';
import { newestIso } from '@/lib/seo/sitemap-dates';

describe('newestIso', () => {
  it('devuelve undefined con lista vacía', () => {
    expect(newestIso([])).toBeUndefined();
  });

  it('devuelve undefined con solo null, undefined y strings vacíos', () => {
    expect(newestIso([null, undefined, ''])).toBeUndefined();
  });

  it('devuelve la fecha mayor entre dos válidas', () => {
    expect(newestIso(['2026-01-01T00:00:00Z', '2026-03-15T12:00:00Z'])).toBe(
      '2026-03-15T12:00:00Z'
    );
  });

  it('ignora fechas no parseables mezcladas con válidas', () => {
    expect(newestIso(['no-es-fecha', '2026-02-10T00:00:00Z'])).toBe('2026-02-10T00:00:00Z');
  });

  it('devuelve el string original sin reformatear', () => {
    expect(newestIso(['2026-05-01', '2026-01-01T00:00:00Z'])).toBe('2026-05-01');
  });

  it('compara por instante entre zonas horarias distintas, no por texto', () => {
    expect(newestIso(['2026-06-01T23:00:00-02:00', '2026-06-02T00:30:00Z'])).toBe(
      '2026-06-01T23:00:00-02:00'
    );
  });
});
