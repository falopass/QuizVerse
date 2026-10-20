/**
 * Tests de render de QUAL-40: el índice del catálogo `/{locale}/indice`.
 *
 * La página enlaza cada quiz publicado una sola vez y cada hub de categoría,
 * y emite JSON-LD (WebPage + BreadcrumbList + ItemList de hubs). Hasta aquí
 * solo `buildCatalogIndex` tenía cobertura; el render completo no.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CatalogCard } from '@/lib/data/catalog-cards';
import type { Quiz } from '@/types/quiz';

const dbMocks = vi.hoisted(() => ({
  getCatalogCards: vi.fn(),
}));

vi.mock('@/lib/data/catalog-cards', () => ({
  getCatalogCards: dbMocks.getCatalogCards,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import CatalogIndexPage from '@/app/[locale]/indice/page';

const MOVIES = { slug: 'movies-tv', name: 'Movies & TV' };
const GAMING = { slug: 'gaming', name: 'Gaming' };

// La página pide filas ligeras (CatalogCard); `language` solo existe en el
// fixture para que el mock filtre por locale como hace la capa real.
type FixtureCard = CatalogCard & { language: Quiz['language'] };

function makeCard(overrides: Partial<FixtureCard> = {}): FixtureCard {
  return {
    slug: 'quiz-1',
    title: 'Quiz de prueba',
    quiz_type: 'trivia',
    language: 'es',
    category: MOVIES,
    ...overrides,
  };
}

const CATALOG: FixtureCard[] = [
  makeCard({ slug: 'trivia-cine', title: 'Trivia de cine' }),
  makeCard({ slug: 'oscar-trivia', title: 'Trivia de los Óscar' }),
  makeCard({
    slug: 'que-personaje-eres',
    title: '¿Qué personaje eres?',
    quiz_type: 'personality',
  }),
  makeCard({ slug: 'trivia-gaming', title: 'Trivia de videojuegos', category: GAMING }),
  makeCard({
    slug: 'que-clase-eres',
    title: '¿Qué clase eres?',
    quiz_type: 'personality',
    category: GAMING,
  }),
];

// Un quiz en inglés dentro del origen: si la página dejara de pasar `locale` a
// getCatalogCards, se colaría en /es/indice y los tests lo detectarían.
const EN_QUIZ = makeCard({ slug: 'en-movies', title: 'Movies quiz', language: 'en' });
const DB = [...CATALOG, EN_QUIZ];

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  const graph = JSON.parse(script!.textContent!) as {
    '@graph': Array<Record<string, unknown>>;
  };
  return graph['@graph'];
}

beforeEach(() => {
  dbMocks.getCatalogCards.mockReset();
  // El mock respeta el `locale` que recibe, como hace la capa real: así un
  // índice que mezcle idiomas queda detectado por los tests.
  dbMocks.getCatalogCards.mockImplementation((locale: string) =>
    Promise.resolve(DB.filter((quiz) => quiz.language === locale))
  );
});

describe('CatalogIndexPage · render', () => {
  it('pinta h1 y la intro con el total del catálogo', async () => {
    render(await CatalogIndexPage({ params: Promise.resolve({ locale: 'es' }) }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Índice del catálogo' })
    ).toBeInTheDocument();
    // El copy de intro interpola el total; se compara el número, no el párrafo.
    expect(screen.getByText(/5 quizzes/)).toBeInTheDocument();
  });

  it('agrupa con un h2 por categoría y su conteo', async () => {
    render(await CatalogIndexPage({ params: Promise.resolve({ locale: 'es' }) }));

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Cine y televisión (3)',
      'Videojuegos (2)',
    ]);
    // El h2 enlaza al hub de la categoría.
    expect(screen.getByRole('link', { name: 'Cine y televisión' })).toHaveAttribute(
      'href',
      '/es/category/movies-tv'
    );
  });

  it('enlaza cada quiz del catálogo a /{locale}/quiz/{slug}', async () => {
    render(await CatalogIndexPage({ params: Promise.resolve({ locale: 'es' }) }));

    for (const quiz of CATALOG) {
      const link = screen.getByRole('link', { name: quiz.title });
      expect(link).toHaveAttribute('href', `/es/quiz/${quiz.slug}`);
    }
    // El quiz en inglés del origen no se cuela en el índice en español.
    expect(screen.queryByRole('link', { name: EN_QUIZ.title })).not.toBeInTheDocument();
    expect(dbMocks.getCatalogCards).toHaveBeenCalledWith('es');
  });

  it('emite JSON-LD con WebPage, BreadcrumbList e ItemList de hubs', async () => {
    const { container } = render(
      await CatalogIndexPage({ params: Promise.resolve({ locale: 'es' }) })
    );

    const graph = jsonLd(container);
    const types = graph.map((node) => node['@type']);
    expect(types).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'ItemList']));

    const itemList = graph.find((node) => node['@type'] === 'ItemList') as {
      itemListElement: Array<{ name: string; url: string }>;
    };
    // El ItemList lista los hubs: tipos de quiz + categorías pobladas.
    const urls = itemList.itemListElement.map((item) => item.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/es/category/trivia'),
        expect.stringContaining('/es/category/personality'),
        expect.stringContaining('/es/category/movies-tv'),
        expect.stringContaining('/es/category/gaming'),
      ])
    );
    // Cada hub aparece también como enlace del nav.
    const nav = screen.getByRole('navigation', { name: 'Índice del catálogo' });
    expect(nav.querySelectorAll('a')).toHaveLength(itemList.itemListElement.length);
  });

  it('locale desconocido dispara notFound()', async () => {
    await expect(CatalogIndexPage({ params: Promise.resolve({ locale: 'fr' }) })).rejects.toThrow(
      'notFound'
    );
  });
});
