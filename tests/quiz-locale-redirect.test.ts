/**
 * SEO-I18N-08: un slug publicado pedido bajo el locale equivocado debe resolver
 * a una URL viva en vez de 404ear. `getQuizLocaleRedirect` decide entre el par
 * traducido (si existe en el idioma pedido) y el mismo slug en su idioma real.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type DbResult = {
  data: unknown;
  error?: { message: string } | null;
};

type Handler = (table: string, select: string, filters: string[]) => DbResult;

const db = vi.hoisted(() => ({
  handler: ((_table: string, _select: string, _filters: string[]): DbResult => ({
    data: [],
    error: null,
  })) as Handler,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const filters: string[] = [];
      let selectCols = '*';
      const resolve = (): DbResult => db.handler(table, selectCols, filters);
      const query = {
        select: (cols?: string) => {
          selectCols = cols ?? '*';
          return query;
        },
        eq: (col: string, val: string) => {
          filters.push(`eq:${col}=${val}`);
          return query;
        },
        neq: (col: string, val: string) => {
          filters.push(`neq:${col}=${val}`);
          return query;
        },
        order: () => query,
        range: () => query,
        limit: () => query,
        single: async () => {
          const res = resolve();
          const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
          return { data: res.error ? null : data, error: res.error ?? null };
        },
        then: (
          onFulfilled?: null | ((value: DbResult) => unknown),
          onRejected?: null | ((reason: unknown) => unknown)
        ) => {
          const pending = new Promise<DbResult>((res, rej) => {
            try {
              res(resolve());
            } catch (error) {
              rej(error);
            }
          });
          return pending.then(onFulfilled ?? undefined, onRejected ?? undefined);
        },
      };
      return query;
    },
  }),
}));

vi.mock('@/lib/data/launch-catalog', () => ({
  LAUNCH_CATEGORIES: [],
  LAUNCH_QUIZZES: [],
}));

vi.mock('@/lib/data/normalizers', () => ({
  normalizeCategory: (row: unknown) => row,
  normalizeProfile: (row: unknown) => row,
  normalizeAchievement: (row: unknown) => row,
  normalizeGameSession: (row: unknown) => row,
  normalizeQuiz: (row: Record<string, unknown>, categories: Map<string, unknown>) => ({
    ...row,
    category: categories.get(row.category_id as string) ?? null,
  }),
}));

import { getQuizLocaleRedirect } from '@/lib/data/public';

function quizRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    slug: 'quiz-one',
    title: 'Quiz One',
    language: 'en',
    category_id: null,
    status: 'published',
    quiz_type: 'trivia',
    questions: [],
    results: null,
    tags: [],
    plays_count: 0,
    ...overrides,
  };
}

// `en-star-wars-fan-trivia-challenge` ↔ `es-trivia-fan-de-star-wars` es un par
// real del mapa regenerado; los `solo-*` no tienen traducción.
const QUIZZES = [
  quizRow({ id: 'q1', slug: 'en-star-wars-fan-trivia-challenge', language: 'en' }),
  quizRow({ id: 'q2', slug: 'es-trivia-fan-de-star-wars', language: 'es' }),
  quizRow({ id: 'q3', slug: 'en-solo-english-trivia', language: 'en' }),
  quizRow({ id: 'q4', slug: 'es-trivia-solo-espanol', language: 'es' }),
];

beforeEach(() => {
  db.handler = (table, _select, filters) => {
    if (table !== 'quizzes') return { data: [], error: null };
    const wanted = filters
      .filter((filter) => filter.startsWith('eq:'))
      .map((filter) => filter.slice(3).split('='));
    return {
      data: QUIZZES.filter((row) =>
        wanted.every(([column, value]) => String(row[column as keyof typeof row]) === value)
      ),
      error: null,
    };
  };
});

describe('getQuizLocaleRedirect', () => {
  it('con par traducido, manda al par en el idioma pedido', async () => {
    await expect(getQuizLocaleRedirect('en-star-wars-fan-trivia-challenge', 'es')).resolves.toEqual(
      { locale: 'es', slug: 'es-trivia-fan-de-star-wars' }
    );
  });

  it('sin par traducido, manda al mismo slug en su idioma real', async () => {
    await expect(getQuizLocaleRedirect('en-solo-english-trivia', 'es')).resolves.toEqual({
      locale: 'en',
      slug: 'en-solo-english-trivia',
    });
  });

  it('funciona en el sentido es → en', async () => {
    await expect(getQuizLocaleRedirect('es-trivia-fan-de-star-wars', 'en')).resolves.toEqual({
      locale: 'en',
      slug: 'en-star-wars-fan-trivia-challenge',
    });
  });

  it('devuelve null cuando el slug no existe en ningún idioma', async () => {
    await expect(getQuizLocaleRedirect('no-existe-en-ninguno', 'es')).resolves.toBeNull();
  });

  it('con keepSameQuiz no cambia de quiz aunque haya par traducido', async () => {
    await expect(
      getQuizLocaleRedirect('en-star-wars-fan-trivia-challenge', 'es', { keepSameQuiz: true })
    ).resolves.toEqual({ locale: 'en', slug: 'en-star-wars-fan-trivia-challenge' });
  });
});
