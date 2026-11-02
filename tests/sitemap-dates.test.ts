import { describe, expect, it } from 'vitest';
import { newestIso, quizLastModified } from '@/lib/seo/sitemap-dates';

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

describe('quizLastModified', () => {
  it('usa content_updated_at cuando la fila lo trae', () => {
    expect(
      quizLastModified({
        content_updated_at: '2026-10-20T00:00:00Z',
        published_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-10-19T00:00:00Z',
      })
    ).toBe('2026-10-20T00:00:00Z');
  });

  it('sin content_updated_at usa la edición posterior a la publicación', () => {
    expect(
      quizLastModified({
        published_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      })
    ).toBe('2026-03-01T00:00:00Z');
  });

  it('sin edición posterior devuelve published_at', () => {
    expect(
      quizLastModified({
        published_at: '2026-03-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })
    ).toBe('2026-03-01T00:00:00Z');
  });

  it('ignora el updated_at del import masivo, que es igual a created_at', () => {
    expect(
      quizLastModified({
        published_at: '2026-05-21T02:09:36.215Z',
        created_at: '2026-09-27T01:46:57.251Z',
        updated_at: '2026-09-27T01:46:57.251Z',
      })
    ).toBe('2026-05-21T02:09:36.215Z');
  });

  it('conserva la fecha de un lote de 50 ediciones reales', () => {
    const dates = Array.from({ length: 50 }, () =>
      quizLastModified({
        published_at: '2026-05-01T00:00:00Z',
        created_at: '2026-09-27T01:46:57.251Z',
        updated_at: '2026-10-19T17:54:02.393Z',
      })
    );
    expect(new Set(dates)).toEqual(new Set(['2026-10-19T17:54:02.393Z']));
  });

  it('usa updated_at si no hay published_at', () => {
    expect(quizLastModified({ published_at: null, updated_at: '2026-02-01T00:00:00Z' })).toBe(
      '2026-02-01T00:00:00Z'
    );
  });

  it('sin publicación y sin edición no anuncia una modificación inexistente', () => {
    expect(
      quizLastModified({
        published_at: null,
        created_at: '2026-09-27T01:46:57.251Z',
        updated_at: '2026-09-27T01:46:57.251Z',
      })
    ).toBeUndefined();
  });

  it('sin fechas válidas devuelve undefined para omitir lastmod', () => {
    expect(quizLastModified({ published_at: null, updated_at: null })).toBeUndefined();
    expect(quizLastModified({ published_at: '', updated_at: 'no-es-fecha' })).toBeUndefined();
    expect(quizLastModified({})).toBeUndefined();
  });
});
