/**
 * PERF-03 / PERF-10 / PERF-16: la caché de datos del catálogo público.
 *
 * - Las lecturas de catálogo van por el cliente sin cookies (`public.ts`):
 *   dentro de `unstable_cache` no se puede leer la request, así que el cliente
 *   de sesión no puede aparecer.
 * - Cada wrapper declara sus tags (`quizzes`, `quiz:<slug>`, `categories`) y su
 *   ventana de revalidación.
 * - La ficha resuelve los relacionados con una sonda de una columna, en
 *   paralelo con la carga principal.
 *
 * La invalidación de esos tags desde las acciones se prueba en
 * `quiz-actions-revalidate.test.ts` y `moderation-actions.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type DbResult = {
  data: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type Handler = (table: string, select: string, filters: string[]) => DbResult;

const db = vi.hoisted(() => ({
  calls: [] as string[],
  handler: ((_table: string, _select: string, _filters: string[]) => ({
    data: [],
    error: null,
  })) as Handler,
}));

const cacheCalls = vi.hoisted(
  () => [] as Array<{ keyParts: string[]; options: { tags?: string[]; revalidate?: number } }>
);

vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: unknown,
    keyParts: string[],
    options: { tags?: string[]; revalidate?: number }
  ) => {
    cacheCalls.push({ keyParts, options });
    return fn;
  },
}));

// El catálogo cacheado no puede tocar la sesión: cualquier llamada revienta.
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => {
    throw new Error('session client used by a cached catalog read');
  },
}));

const fakeClient = vi.hoisted(() => () => ({
  from: (table: string) => {
    const filters: string[] = [];
    let selectCols = '*';
    const resolve = (): DbResult => {
      db.calls.push(`${table}(${selectCols})${filters.length ? ` ${filters.join(' ')}` : ''}`);
      return db.handler(table, selectCols, filters);
    };
    const single = async () => {
      const res = resolve();
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return { data: res.error ? null : data, error: res.error ?? null };
    };
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
      single,
      maybeSingle: single,
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
}));

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: fakeClient }));

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

import {
  getCategoryPayload,
  getPublicCategories,
  getPublishedQuizzes,
  getQuizBySlug,
  getRelatedQuizzesBySlug,
} from '@/lib/data/public';

const categoryRow = { id: 'cat-1', slug: 'movies-tv', name: 'Movies & TV', sort_order: 0 };

function quizRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    slug: 'demo',
    title: 'Demo quiz',
    language: 'en',
    category_id: 'cat-1',
    status: 'published',
    quiz_type: 'trivia',
    questions: [],
    results: null,
    tags: [],
    plays_count: 0,
    likes_count: 0,
    estimated_minutes: 3,
    is_featured: false,
    created_at: '2026-01-01T00:00:00Z',
    published_at: null,
    ...overrides,
  };
}

function wrapperFor(keyPart: string) {
  return cacheCalls.find((call) => call.keyParts.includes(keyPart));
}

beforeEach(() => {
  db.calls = [];
  // `cacheCalls` no se limpia: los wrappers de módulo se registran al importar
  // y son justamente lo que estos tests comprueban.
  db.handler = () => ({ data: [], error: null });
});

describe('cliente sin cookies', () => {
  it('getPublicCategories lee con el cliente público', async () => {
    db.handler = (table) =>
      table === 'categories' ? { data: [categoryRow], error: null } : { data: [] };

    expect(await getPublicCategories()).toEqual([categoryRow]);
  });

  it('getQuizBySlug y los publicados no tocan el cliente de sesión', async () => {
    db.handler = (table, select) =>
      table === 'categories'
        ? { data: [categoryRow], error: null }
        : select === '*'
          ? { data: [quizRow()], error: null }
          : { data: [], error: null };

    expect((await getQuizBySlug('demo', 'en'))?.slug).toBe('demo');
    expect((await getPublishedQuizzes(5, 'en')).map((quiz) => quiz.slug)).toEqual(['demo']);
  });
});

describe('tags y ventana de revalidación', () => {
  it('categorías y quizzes declaran su tag y 300 s', async () => {
    db.handler = (table) =>
      table === 'categories'
        ? { data: [categoryRow], error: null }
        : { data: [quizRow()], error: null };

    await getPublicCategories();
    await getPublishedQuizzes(5, 'en');

    const categories = wrapperFor('public-categories');
    expect(categories?.options.tags).toEqual(['categories']);
    expect(categories?.options.revalidate).toBe(300);

    const published = wrapperFor('published-quizzes');
    expect(published?.options.tags).toEqual(['quizzes']);
    expect(published?.options.revalidate).toBe(300);
  });

  it('la ficha y sus relacionados llevan el tag por slug', async () => {
    db.handler = (table, select) =>
      table === 'categories'
        ? { data: [categoryRow], error: null }
        : select === 'category:categories(slug)'
          ? { data: { category: { slug: 'movies-tv' } }, error: null }
          : { data: [quizRow()], error: null };

    await getQuizBySlug('demo', 'en');
    await getRelatedQuizzesBySlug('demo');

    expect(wrapperFor('quiz-by-slug')?.options.tags).toEqual(['quizzes', 'quiz:demo']);
    expect(wrapperFor('related-quizzes')?.options.tags).toEqual(['quizzes', 'quiz:demo']);
    expect(wrapperFor('quiz-category')?.options.tags).toEqual(['quizzes', 'quiz:demo']);
  });

  it('el payload de categoría se cachea con el tag quizzes', async () => {
    db.handler = (table, select) =>
      table === 'categories'
        ? { data: [categoryRow], error: null }
        : select === 'category:categories(slug)'
          ? { data: [], error: null }
          : { data: [quizRow()], error: null, count: 1 };

    await getCategoryPayload('movies-tv', 'en');

    expect(wrapperFor('category-page')?.options.tags).toEqual(['quizzes']);
  });
});

describe('getRelatedQuizzesBySlug', () => {
  it('resuelve la categoría con una sonda de una columna y consulta los relacionados', async () => {
    db.handler = (table, select) => {
      if (table === 'categories') return { data: [categoryRow], error: null };
      if (select === 'category:categories(slug)') {
        return { data: { category: { slug: 'movies-tv' } }, error: null };
      }
      return {
        data: [quizRow({ id: 'q-2', slug: 'otro', category_id: 'cat-1' })],
        error: null,
      };
    };

    const related = await getRelatedQuizzesBySlug('demo');

    expect(related.map((quiz) => quiz.slug)).toEqual(['otro']);
    // La sonda pide solo la categoría del quiz, no el payload completo.
    expect(db.calls).toContain(
      'quizzes(category:categories(slug)) eq:slug=demo eq:status=published'
    );
  });

  it('devuelve [] cuando el quiz no tiene categoría', async () => {
    db.handler = (table, select) =>
      table === 'categories'
        ? { data: [categoryRow], error: null }
        : select === 'category:categories(slug)'
          ? { data: { category: null }, error: null }
          : { data: [quizRow()], error: null };

    expect(await getRelatedQuizzesBySlug('demo')).toEqual([]);
  });
});
