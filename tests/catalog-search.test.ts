/**
 * FIX-26: `listPublishedQuizzes` busca `q` en título, descripción y tags — la
 * misma semántica que el explorador — con un `or` de PostgREST. Los valores
 * van entrecomillados para que comas y `{}` del término no partan la
 * expresión, y `escapeLike` sigue protegiendo los comodines de `like`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizQuery } from '@/lib/api/query';

interface RecordedQuery {
  eqs: Array<[string, unknown]>;
  ilikes: Array<[string, string]>;
  ors: string[];
}

const recorded = new Map<string, RecordedQuery[]>();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const log: RecordedQuery = { eqs: [], ilikes: [], ors: [] };
      const perTable = recorded.get(table) ?? [];
      perTable.push(log);
      recorded.set(table, perTable);

      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          log.eqs.push([column, value]);
          return builder;
        },
        ilike: (column: string, value: string) => {
          log.ilikes.push([column, value]);
          return builder;
        },
        or: (expression: string) => {
          log.ors.push(expression);
          return builder;
        },
        order: () => builder,
        range: () => Promise.resolve({ data: [], error: null, count: 0 }),
        limit: () => Promise.resolve({ data: [], error: null, count: 0 }),
      };
      return builder;
    },
  }),
}));

import { listPublishedQuizzes } from '@/lib/data/catalog';

const BASE: QuizQuery = { page: 1, limit: 20 };

beforeEach(() => {
  recorded.clear();
});

function quizFilters() {
  return recorded.get('quizzes')?.[0];
}

describe('listPublishedQuizzes búsqueda multicampo', () => {
  it.each([undefined, '', '   '])('q=%j no añade filtro alguno', async (q) => {
    await listPublishedQuizzes({ ...BASE, q });

    expect(quizFilters()?.ors).toEqual([]);
    expect(quizFilters()?.ilikes).toEqual([]);
  });

  it('q normal añade un or sobre title, description y tags', async () => {
    await listPublishedQuizzes({ ...BASE, q: 'star wars' });

    expect(quizFilters()?.ors).toEqual([
      'title.ilike."%star wars%",description.ilike."%star wars%",tags.cs."{star wars}"',
    ]);
    expect(quizFilters()?.ilikes).toEqual([]);
  });

  it('ignora el margen del término antes de filtrar', async () => {
    await listPublishedQuizzes({ ...BASE, q: '  marvel  ' });

    expect(quizFilters()?.ors).toEqual([
      'title.ilike."%marvel%",description.ilike."%marvel%",tags.cs."{marvel}"',
    ]);
  });

  it('escapa los comodines de like y la coma no parte la expresión', async () => {
    await listPublishedQuizzes({ ...BASE, q: 'a%,b_c' });

    expect(quizFilters()?.ors).toEqual([
      'title.ilike."%a\\%,b\\_c%",description.ilike."%a\\%,b\\_c%",tags.cs."{a\\%,b\\_c}"',
    ]);
  });

  it('un término que se reduce a caracteres no escapables no filtra', async () => {
    await listPublishedQuizzes({ ...BASE, q: '"{' });

    expect(quizFilters()?.ors).toEqual([]);
  });
});
