import { describe, expect, it } from 'vitest';
import { PaginationSchema, QuizQuerySchema, jsonError, jsonOk, parseQuery } from '@/lib/api/query';

function params(input: Record<string, string>): URLSearchParams {
  return new URLSearchParams(input);
}

describe('parseQuery', () => {
  it('aplica valores por defecto', () => {
    const result = parseQuery(QuizQuerySchema, params({}));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.locale).toBeUndefined();
    }
  });

  it('convierte strings a números', () => {
    const result = parseQuery(QuizQuerySchema, params({ page: '3', limit: '10' }));
    expect(result.ok && result.data.page).toBe(3);
    expect(result.ok && result.data.limit).toBe(10);
  });

  it('rechaza límites fuera de rango', () => {
    expect(parseQuery(QuizQuerySchema, params({ limit: '51' })).ok).toBe(false);
    expect(parseQuery(QuizQuerySchema, params({ limit: '0' })).ok).toBe(false);
    expect(parseQuery(QuizQuerySchema, params({ page: '0' })).ok).toBe(false);
  });

  it('valida locale, categoría y búsqueda', () => {
    expect(parseQuery(QuizQuerySchema, params({ locale: 'fr' })).ok).toBe(false);
    expect(parseQuery(QuizQuerySchema, params({ category: 'Movies TV!' })).ok).toBe(false);
    expect(parseQuery(QuizQuerySchema, params({ q: 'a' })).ok).toBe(false);
    const ok = parseQuery(
      QuizQuerySchema,
      params({ locale: 'es', category: 'movies-tv', q: 'marvel' })
    );
    expect(ok.ok).toBe(true);
  });

  it('devuelve errores por campo, no una excepción', () => {
    const result = parseQuery(QuizQuerySchema, params({ limit: '999', page: '-1' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).length).toBeGreaterThan(0);
    }
  });

  it('acepta el esquema de paginación sin filtros de catálogo', () => {
    expect(parseQuery(PaginationSchema, params({ limit: '5' })).ok).toBe(true);
  });
});

describe('respuestas JSON', () => {
  it('jsonOk marca la respuesta como cacheable', async () => {
    const response = jsonOk({ hello: 'world' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(await response.json()).toEqual({ hello: 'world' });
  });

  it('jsonError no se cachea y conserva el status', async () => {
    const response = jsonError(400, 'invalid_query', { limit: ['max 50'] });
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: 'invalid_query',
      details: { limit: ['max 50'] },
    });
  });
});
