import { describe, expect, it } from 'vitest';
import {
  MASS_UPDATE_MIN_ROWS,
  massUpdatedAt,
  newestIso,
  quizLastModified,
} from '@/lib/seo/sitemap-dates';

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
        updated_at: '2026-10-19T00:00:00Z',
      })
    ).toBe('2026-10-20T00:00:00Z');
  });

  it('sin content_updated_at usa la edición posterior a la publicación', () => {
    expect(
      quizLastModified({
        published_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      })
    ).toBe('2026-03-01T00:00:00Z');
  });

  it('sin edición posterior devuelve published_at', () => {
    expect(
      quizLastModified({
        published_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })
    ).toBe('2026-03-01T00:00:00Z');
  });

  it('ignora un updated_at de import masivo y cae en published_at', () => {
    const mass = massUpdatedAt(
      Array.from({ length: MASS_UPDATE_MIN_ROWS }, () => '2026-09-27T01:46:57.251Z')
    );
    expect(
      quizLastModified(
        {
          published_at: '2026-05-21T02:09:36.215Z',
          updated_at: '2026-09-27T01:46:57.251Z',
        },
        mass
      )
    ).toBe('2026-05-21T02:09:36.215Z');
  });

  it('usa updated_at si no hay published_at', () => {
    expect(quizLastModified({ published_at: null, updated_at: '2026-02-01T00:00:00Z' })).toBe(
      '2026-02-01T00:00:00Z'
    );
  });

  it('sin fechas válidas devuelve undefined para omitir lastmod', () => {
    expect(quizLastModified({ published_at: null, updated_at: null })).toBeUndefined();
    expect(quizLastModified({ published_at: '', updated_at: 'no-es-fecha' })).toBeUndefined();
    expect(quizLastModified({})).toBeUndefined();
  });
});

describe('massUpdatedAt', () => {
  it('marca los timestamps que comparten muchas filas', () => {
    const mass = massUpdatedAt([
      ...Array.from({ length: MASS_UPDATE_MIN_ROWS }, () => '2026-09-27T01:46:57.251Z'),
      '2026-10-19T17:54:02.393Z',
      null,
      'no-es-fecha',
    ]);
    expect([...mass]).toEqual(['2026-09-27T01:46:57.251Z']);
  });

  it('no marca un lote pequeño ni fechas únicas', () => {
    expect(
      massUpdatedAt(
        Array.from({ length: MASS_UPDATE_MIN_ROWS - 1 }, () => '2026-09-27T01:46:57.251Z')
      ).size
    ).toBe(0);
    expect(massUpdatedAt(['2026-10-19T17:54:02.393Z', '2026-10-19T17:54:03.555Z']).size).toBe(0);
  });
});
