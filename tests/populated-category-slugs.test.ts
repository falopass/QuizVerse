/**
 * SEO-I18N-06, lado de datos: `getPopulatedCategorySlugs` entrega al footer el
 * mismo conjunto que anuncia el sitemap (categorías con ≥1 quiz publicado en
 * el locale), cae al catálogo de lanzamiento si el conteo falla y se cachea
 * entre requests con `unstable_cache` (tag `quizzes`) en vez de pagar la
 * consulta en cada request.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rangeMock = vi.fn();
const createClientMock = vi.fn();
const cacheCalls = vi.hoisted(
  () => [] as Array<{ keyParts: string[]; options: { tags?: string[]; revalidate?: number } }>
);

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => createClientMock(),
}));
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

vi.mock('@/lib/data/launch-catalog', () => ({
  LAUNCH_CATEGORIES: [],
  LAUNCH_QUIZZES: [
    { language: 'en', category: { slug: 'culture' } },
    { language: 'es', category: { slug: 'culture' } },
    { language: 'es', category: { slug: 'gaming' } },
    { language: 'es', category: null },
  ],
}));

// Cada test importa una instancia limpia del módulo (y de su wrapper de caché).
async function load() {
  vi.resetModules();
  return (await import('@/lib/data/category-counts')).getPopulatedCategorySlugs;
}

beforeEach(() => {
  rangeMock.mockReset();
  cacheCalls.length = 0;
  createClientMock.mockReset().mockReturnValue({
    from: () => {
      const query = {
        eq: () => query,
        order: () => query,
        range: rangeMock,
      };
      return { select: () => query };
    },
  });
});

describe('getPopulatedCategorySlugs', () => {
  it('devuelve solo las categorías con quizzes publicados en el locale', async () => {
    const getPopulatedCategorySlugs = await load();
    rangeMock.mockResolvedValueOnce({
      data: [
        { category: { slug: 'movies-tv' } },
        { category: { slug: 'movies-tv' } },
        { category: { slug: 'gaming' } },
        { category: null },
      ],
      error: null,
    });

    const slugs = await getPopulatedCategorySlugs('es');

    expect([...slugs].sort()).toEqual(['gaming', 'movies-tv']);
  });

  it('sin quizzes publicados en el locale no enlaza ninguna categoría', async () => {
    const getPopulatedCategorySlugs = await load();
    rangeMock.mockResolvedValueOnce({ data: [], error: null });

    const slugs = await getPopulatedCategorySlugs('es');

    // El catálogo de lanzamiento tiene culture/gaming para `es`, pero un
    // conteo vacío es un idioma sin quizzes: sus hubs hacen notFound().
    expect([...slugs]).toEqual([]);
  });

  it('cae al catálogo de lanzamiento del locale si el conteo falla', async () => {
    const getPopulatedCategorySlugs = await load();
    rangeMock.mockResolvedValueOnce({ data: null, error: { message: 'down' } });

    const slugs = await getPopulatedCategorySlugs('es');

    expect([...slugs].sort()).toEqual(['culture', 'gaming']);
  });

  it('un fallo no se cachea: el siguiente request reintenta', async () => {
    const getPopulatedCategorySlugs = await load();
    rangeMock
      .mockResolvedValueOnce({ data: null, error: { message: 'down' } })
      .mockResolvedValueOnce({ data: [{ category: { slug: 'gaming' } }], error: null });

    await getPopulatedCategorySlugs('es');
    const slugs = await getPopulatedCategorySlugs('es');

    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect([...slugs]).toEqual(['gaming']);
  });

  it('se envuelve en unstable_cache con el tag quizzes y la ventana del catálogo', async () => {
    await load();

    const wrapper = cacheCalls.find((call) => call.keyParts.includes('published-quiz-counts'));
    expect(wrapper).toBeDefined();
    expect(wrapper?.options.tags).toEqual(expect.arrayContaining(['quizzes', 'categories']));
    expect(wrapper?.options.revalidate).toBe(300);
  });
});
