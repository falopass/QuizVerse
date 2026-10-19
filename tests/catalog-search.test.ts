/**
 * FIX-26: `listPublishedQuizzes` busca `q` en título, descripción y tags — la
 * misma semántica que el explorador — con un `or` de PostgREST. Los valores
 * van entrecomillados y en doble escape (capa PostgREST + capa SQL) para que
 * comodines de `like`, comas, comillas y llaves del término lleguen literales.
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

/**
 * Réplica mínima del lexer de valores del `or` de PostgREST
 * (`pLogicSingleVal`/`pQuotedValue`): las comas fuera de comillas separan
 * condiciones; dentro, `\x` decodifica a `x` (`\\`→`\`, `\"`→`"`).
 */
function decodeOrConditions(expression: string): string[] {
  const conditions: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < expression.length; i += 1) {
    const ch = expression[i];
    if (quoted) {
      if (ch === '\\') {
        current += expression[(i += 1)];
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      conditions.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  conditions.push(current);
  return conditions;
}

function decodedOrs() {
  return (quizFilters()?.ors ?? []).flatMap(decodeOrConditions);
}

describe('listPublishedQuizzes búsqueda multicampo', () => {
  it.each([undefined, '', '   '])('q=%j no añade filtro alguno', async (q) => {
    await listPublishedQuizzes({ ...BASE, q });

    expect(quizFilters()?.ors).toEqual([]);
    expect(quizFilters()?.ilikes).toEqual([]);
  });

  it('q normal busca en title, description y tags (tag como elemento único)', async () => {
    await listPublishedQuizzes({ ...BASE, q: 'star wars' });

    expect(quizFilters()?.ors).toHaveLength(1);
    expect(quizFilters()?.ilikes).toEqual([]);
    expect(decodedOrs()).toEqual([
      'title.ilike.%star wars%',
      'description.ilike.%star wars%',
      'tags.cs.{"star wars"}',
    ]);
  });

  it('ignora el margen del término antes de filtrar', async () => {
    await listPublishedQuizzes({ ...BASE, q: '  marvel  ' });

    expect(decodedOrs()).toEqual([
      'title.ilike.%marvel%',
      'description.ilike.%marvel%',
      'tags.cs.{"marvel"}',
    ]);
  });

  it('los comodines de like llegan escapados a SQL pese al quoting', async () => {
    await listPublishedQuizzes({ ...BASE, q: '100%_off' });

    // Sin la doble capa, el `\` de escapeLike se lo come el lexer de
    // PostgREST y el comodín queda vivo.
    expect(decodedOrs()).toEqual([
      'title.ilike.%100\\%\\_off%',
      'description.ilike.%100\\%\\_off%',
      'tags.cs.{"100%_off"}',
    ]);
  });

  it('una coma del término no parte el or ni el literal de array', async () => {
    await listPublishedQuizzes({ ...BASE, q: 'a,b' });

    // Una sola condición por campo y el elemento de tags sigue siendo uno:
    // `{"a,b"}` exige el tag literal `a,b`, no tags `a` y `b` por separado.
    expect(decodedOrs()).toEqual([
      'title.ilike.%a,b%',
      'description.ilike.%a,b%',
      'tags.cs.{"a,b"}',
    ]);
  });

  it('comillas y llaves del término se codifican, no se descartan', async () => {
    await listPublishedQuizzes({ ...BASE, q: 'a"b{c}' });

    expect(decodedOrs()).toEqual([
      'title.ilike.%a"b{c}%',
      'description.ilike.%a"b{c}%',
      'tags.cs.{"a\\"b{c}"}',
    ]);
  });

  it('una barra del término viaja literal a las dos capas', async () => {
    await listPublishedQuizzes({ ...BASE, q: 'a\\b' });

    expect(decodedOrs()).toEqual([
      'title.ilike.%a\\\\b%',
      'description.ilike.%a\\\\b%',
      'tags.cs.{"a\\\\b"}',
    ]);
  });
});
