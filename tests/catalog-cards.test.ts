import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const db = vi.hoisted(() => ({
  selects: [] as string[],
  eqs: [] as string[],
  ranges: [] as Array<[number, number]>,
  pages: [] as Array<{ data: unknown; error: unknown }>,
  nextPage: 0,
  clientError: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (db.clientError) throw db.clientError;
    return {
      from: () => {
        const eqs: string[] = [];
        const query = {
          select: (cols: string) => {
            db.selects.push(cols);
            return query;
          },
          eq: (col: string, val: string) => {
            eqs.push(`${col}=${val}`);
            return query;
          },
          order: () => query,
          range: (from: number, to: number) => {
            db.eqs.push(...eqs);
            db.ranges.push([from, to]);
            const page = db.pages[db.nextPage] ?? { data: [], error: null };
            db.nextPage += 1;
            return Promise.resolve(page);
          },
        };
        return query;
      },
    };
  },
}));

vi.mock('@/lib/data/launch-catalog', () => ({
  LAUNCH_QUIZZES: [
    {
      id: 'launch-1',
      slug: 'launch-a',
      title: 'Launch A',
      language: 'en',
      quiz_type: 'trivia',
      category: { id: 'cat-launch', slug: 'culture', name: 'Culture' },
    },
    {
      id: 'launch-2',
      slug: 'launch-b',
      title: 'Launch B',
      language: 'es',
      quiz_type: 'personality',
      category: null,
    },
  ],
}));

import { getCatalogCards } from '@/lib/data/catalog-cards';

const row = (
  slug: string,
  category: { slug: string; name: string } | { slug: string; name: string }[] | null
) => ({ slug, title: `Quiz ${slug}`, quiz_type: 'trivia', category });

beforeEach(() => {
  db.selects = [];
  db.eqs = [];
  db.ranges = [];
  db.pages = [];
  db.nextPage = 0;
  db.clientError = null;
});

describe('getCatalogCards', () => {
  it('pide solo las columnas ligeras: nada de questions ni results', async () => {
    db.pages = [{ data: [], error: null }];

    await getCatalogCards('en');

    const select = db.selects[0];
    expect(select).toContain('slug');
    expect(select).toContain('title');
    expect(select).toContain('quiz_type');
    expect(select).toContain('category:categories(slug, name)');
    expect(select).not.toContain('questions');
    expect(select).not.toContain('results');
  });

  it('filtra por status published y por idioma, paginando por rangos de id', async () => {
    db.pages = [
      {
        data: Array.from({ length: 500 }, (_, i) => row(`q-${i}`, { slug: 'c', name: 'C' })),
        error: null,
      },
      { data: [row('q-500', null)], error: null },
    ];

    const cards = await getCatalogCards('es');

    expect(db.eqs).toContain('status=published');
    expect(db.eqs).toContain('language=es');
    expect(db.ranges[0]).toEqual([0, 499]);
    expect(db.ranges[1]).toEqual([500, 999]);
    expect(db.ranges).toHaveLength(2);
    expect(cards).toHaveLength(501);
  });

  it('mapea el join de categoría venga como objeto, array o null', async () => {
    db.pages = [
      {
        data: [
          row('a', { slug: 'gaming', name: 'Gaming' }),
          row('b', [{ slug: 'music', name: 'Music' }]),
          row('c', null),
        ],
        error: null,
      },
    ];

    const cards = await getCatalogCards('en');

    expect(cards).toEqual([
      {
        slug: 'a',
        title: 'Quiz a',
        quiz_type: 'trivia',
        category: { slug: 'gaming', name: 'Gaming' },
      },
      {
        slug: 'b',
        title: 'Quiz b',
        quiz_type: 'trivia',
        category: { slug: 'music', name: 'Music' },
      },
      { slug: 'c', title: 'Quiz c', quiz_type: 'trivia', category: null },
    ]);
  });

  it('cae al catálogo de lanzamiento filtrado por idioma si la consulta falla, sin lanzar', async () => {
    db.pages = [{ data: null, error: { message: 'boom' } }];

    const cards = await getCatalogCards('es');

    expect(cards).toEqual([
      { slug: 'launch-b', title: 'Launch B', quiz_type: 'personality', category: null },
    ]);
  });

  it('cae al fallback también si no se puede crear el cliente', async () => {
    db.clientError = new Error('missing env');

    const cards = await getCatalogCards('en');

    expect(cards.map((card) => card.slug)).toEqual(['launch-a']);
    expect(cards[0].category).toEqual({ slug: 'culture', name: 'Culture' });
  });
});
