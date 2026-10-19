/**
 * QUAL-29: `listPublishedQuizzes` traduce `category` a hub de tipo o a
 * `category_id`, escapa los comodines de `ilike` en `q`, calcula `hasMore`
 * en el borde de la última página y nunca expone `questions` ni
 * `is_correct` en las tarjetas.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizQuery } from '@/lib/api/query';

interface RecordedQuery {
  selects: Array<{ columns: string; options: unknown }>;
  eqs: Array<[string, unknown]>;
  ilikes: Array<[string, string]>;
  limits: number[];
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
      const log: RecordedQuery = { selects: [], eqs: [], ilikes: [], limits: [] };
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
        order: () => builder,
        range: () => Promise.resolve(takeResult(table)),
        limit: (n: number) => {
          log.limits.push(n);
          return Promise.resolve(takeResult(table));
        },
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
    slug: 'marvel-trivia',
    title: 'Marvel trivia',
    description: 'Preguntas de Marvel',
    quiz_type: 'trivia',
    difficulty: 'easy',
    language: 'en',
    question_count: 10,
    estimated_minutes: 5,
    plays_count: 7,
    cover_image_url: null,
    ...overrides,
  };
}

beforeEach(() => {
  recorded.clear();
  queued.clear();
});

describe('listPublishedQuizzes — category', () => {
  it.each(['trivia', 'personality'])(
    'category=%s filters by quiz_type without touching categories',
    async (hub) => {
      queued.set('quizzes', [{ data: [quizRow()], error: null, count: 1 }]);

      await listPublishedQuizzes({ ...BASE, category: hub });

      expect(recorded.get('categories')).toBeUndefined();
      const eqs = recorded.get('quizzes')?.[0].eqs ?? [];
      expect(eqs).toContainEqual(['quiz_type', hub]);
      expect(eqs.some(([column]) => column === 'category_id')).toBe(false);
    }
  );

  it('category=movies-tv resolves the slug to a category_id filter', async () => {
    queued.set('categories', [{ data: [{ id: 'cat-9' }], error: null }]);
    queued.set('quizzes', [{ data: [quizRow()], error: null, count: 1 }]);

    await listPublishedQuizzes({ ...BASE, category: 'movies-tv' });

    expect(recorded.get('categories')?.[0].eqs).toContainEqual(['slug', 'movies-tv']);
    expect(recorded.get('quizzes')?.[0].eqs).toContainEqual(['category_id', 'cat-9']);
  });

  it('returns an empty page without querying quizzes when the slug does not exist', async () => {
    queued.set('categories', [{ data: [], error: null }]);
    queued.set('quizzes', [{ data: [quizRow()], error: null, count: 1 }]);

    const page = await listPublishedQuizzes({ ...BASE, category: 'no-existe' });

    expect(page).toEqual({ items: [], total: 0, page: 1, limit: 20, hasMore: false });
    // El builder se arma pero nunca se ejecuta: la respuesta sigue encolada.
    expect(queued.get('quizzes')).toHaveLength(1);
    expect(recorded.get('quizzes')?.[0].eqs.some(([c]) => c === 'category_id')).toBe(false);
  });
});

describe('listPublishedQuizzes — search', () => {
  it('escapes % and _ wildcards so ilike stays literal', async () => {
    queued.set('quizzes', [{ data: [], error: null, count: 0 }]);

    await listPublishedQuizzes({ ...BASE, q: '100%_off' });

    const ilikes = recorded.get('quizzes')?.[0].ilikes ?? [];
    expect(ilikes).toEqual([['title', '%100\\%\\_off%']]);
  });
});

describe('listPublishedQuizzes — hasMore edge', () => {
  it('is false when the page ends exactly on total', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => quizRow({ id: `quiz-${i}` }));
    queued.set('quizzes', [{ data: rows, error: null, count: 20 }]);

    const page = await listPublishedQuizzes({ page: 2, limit: 10 });

    expect(page.total).toBe(20);
    expect(page.hasMore).toBe(false);
  });

  it('is false on a short last page and true mid-catalog', async () => {
    queued.set('quizzes', [
      { data: [quizRow()], error: null, count: 21 },
      { data: [quizRow()], error: null, count: 25 },
    ]);

    const last = await listPublishedQuizzes({ page: 2, limit: 20 });
    expect(last.hasMore).toBe(false);

    const middle = await listPublishedQuizzes({ page: 1, limit: 20 });
    expect(middle.hasMore).toBe(true);
  });
});

describe('listPublishedQuizzes — no answer key leaks', () => {
  it('items never contain questions, is_correct or correct_answers even if rows do', async () => {
    queued.set('quizzes', [
      {
        data: [
          quizRow({
            questions: [{ question: 'x', options: [{ text: 'a', is_correct: true }] }],
            correct_answers: [0],
          }),
        ],
        error: null,
        count: 1,
      },
    ]);

    const { items } = await listPublishedQuizzes(BASE);

    expect(items[0]).not.toHaveProperty('questions');
    expect(items[0]).not.toHaveProperty('correct_answers');
    expect(JSON.stringify(items[0])).not.toContain('is_correct');
  });
});
