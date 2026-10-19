/**
 * PERF-03: `listPublishedQuizzes` pide solo las columnas de la tarjeta — ni
 * `questions` ni `correct_answers` ni `results` cruzan el wire — y fija el
 * contrato de `CatalogPage` (paginación con `range`, `hasMore` desde `count`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizQuery } from '@/lib/api/query';

interface RecordedQuery {
  selects: Array<{ columns: string; options: unknown }>;
  eqs: Array<[string, unknown]>;
  ilikes: Array<[string, string]>;
  orders: Array<[string, unknown]>;
  ranges: Array<[number, number]>;
}

interface StubResult {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
  count?: number | null;
}

/** Llamadas al query builder, por tabla, en orden de `from()`. */
const recorded = new Map<string, RecordedQuery[]>();
/** Respuestas encoladas por tabla: cada query que se espera consume una. */
const queued = new Map<string, StubResult[]>();

function takeResult(table: string): StubResult {
  return queued.get(table)?.shift() ?? { data: [], error: null, count: 0 };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const log: RecordedQuery = { selects: [], eqs: [], ilikes: [], orders: [], ranges: [] };
      const perTable = recorded.get(table) ?? [];
      perTable.push(log);
      recorded.set(table, perTable);

      const builder = {
        select: (columns: string, options?: unknown) => {
          log.selects.push({ columns, options });
          return builder;
        },
        eq: (column: string, value: unknown) => {
          log.eqs.push([column, value]);
          return builder;
        },
        ilike: (column: string, value: string) => {
          log.ilikes.push([column, value]);
          return builder;
        },
        order: (column: string, options: unknown) => {
          log.orders.push([column, options]);
          return builder;
        },
        range: (from: number, to: number) => {
          log.ranges.push([from, to]);
          return Promise.resolve(takeResult(table));
        },
        limit: () => Promise.resolve(takeResult(table)),
      };
      return builder;
    },
  }),
}));

import { listPublishedQuizzes } from '@/lib/data/catalog';

const BASE: QuizQuery = { page: 1, limit: 20 };

function quizRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'quiz-1',
    slug: 'capitanes-de-futbol',
    title: 'Capitanes de fútbol',
    description: 'Adivina el capitán',
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    question_count: 8,
    estimated_minutes: 4,
    plays_count: 42,
    cover_image_url: 'https://example.com/cover.jpg',
    ...overrides,
  };
}

beforeEach(() => {
  recorded.clear();
  queued.clear();
});

describe('listPublishedQuizzes', () => {
  it('selecciona las columnas de la tarjeta con count exacto, nunca *', async () => {
    queued.set('quizzes', [{ data: [quizRow()], error: null, count: 1 }]);

    await listPublishedQuizzes(BASE);

    const select = recorded.get('quizzes')?.[0].selects[0];
    const columns = select?.columns ?? '';
    expect(columns).not.toBe('*');
    for (const column of ['slug', 'title', 'language', 'plays_count']) {
      expect(columns).toContain(column);
    }
    expect(columns.split(',')).toHaveLength(11);
    expect(select?.options).toEqual({ count: 'exact' });
  });

  it('resuelve la categoría por slug leyendo solo id', async () => {
    queued.set('categories', [{ data: [{ id: 'cat-1' }], error: null }]);
    queued.set('quizzes', [{ data: [], error: null, count: 0 }]);

    await listPublishedQuizzes({ ...BASE, category: 'gaming' });

    expect(recorded.get('categories')?.[0].selects[0].columns).toBe('id');
    expect(recorded.get('quizzes')?.[0].eqs).toContainEqual(['category_id', 'cat-1']);
  });

  it('pagina con range y calcula hasMore desde el count total', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => quizRow({ id: `quiz-${i}` }));
    queued.set('quizzes', [
      { data: rows, error: null, count: 25 },
      { data: rows, error: null, count: 20 },
    ]);

    const page = await listPublishedQuizzes({ page: 2, limit: 10 });
    expect(recorded.get('quizzes')?.[0].ranges).toEqual([[10, 19]]);
    expect(page.total).toBe(25);
    expect(page.hasMore).toBe(true);

    const last = await listPublishedQuizzes({ page: 2, limit: 10 });
    expect(last.hasMore).toBe(false);
  });

  it('mapea una fila cruda a CatalogCard sin questions ni clave de respuestas', async () => {
    queued.set('quizzes', [
      {
        data: [
          quizRow({
            description: null,
            question_count: null,
            estimated_minutes: null,
            plays_count: null,
            cover_image_url: null,
            questions: [{ question: 'x', options: [] }],
            correct_answers: [0],
            results: [],
          }),
        ],
        error: null,
        count: 1,
      },
    ]);

    const { items } = await listPublishedQuizzes(BASE);

    expect(items[0]).toEqual({
      id: 'quiz-1',
      slug: 'capitanes-de-futbol',
      title: 'Capitanes de fútbol',
      description: '',
      quizType: 'trivia',
      difficulty: 'medium',
      language: 'es',
      questionCount: 0,
      estimatedMinutes: 3,
      plays: 0,
      coverImageUrl: null,
    });
    expect(items[0]).not.toHaveProperty('questions');
    expect(items[0]).not.toHaveProperty('correct_answers');
  });

  it('propaga el error de Supabase como catalog_query_failed', async () => {
    queued.set('quizzes', [{ data: null, error: { message: 'boom' } }]);

    await expect(listPublishedQuizzes(BASE)).rejects.toThrow('catalog_query_failed: boom');
  });
});
