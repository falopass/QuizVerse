/**
 * Tests de render de QUAL-40: la página de categoría `/{locale}/category/{slug}`.
 *
 * Es la plantilla indexable más numerosa del sitio (un hub por categoría con
 * quizzes) y emitía JSON-LD (WebPage + BreadcrumbList + ItemList + FAQPage),
 * la guía editorial y el nav de categorías sin ninguna prueba de componente.
 * Las aserciones de copy se comparan contra `getCategoryGuide`, no contra
 * texto literal: la guía se edita en otros ítems del backlog.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Category, Quiz } from '@/types/quiz';
import { getCategoryGuide } from '@/lib/i18n/category-guides';
import { localizeCategory } from '@/lib/i18n/catalog';

const dbMocks = vi.hoisted(() => ({
  getCategoryPayload: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getCategoryPayload: dbMocks.getCategoryPayload,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import LocalizedCategoryPage from '@/app/[locale]/category/[slug]/page';

const category = (slug: string, name: string): Category => ({
  id: `cat-${slug}`,
  name,
  slug,
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 0,
  sort_order: 0,
});

const MOVIES = { ...category('movies-tv', 'Movies & TV'), description: 'Tests de cine y series.' };
const ANIME = category('anime-manga', 'Anime & Manga');
const GAMING = category('gaming', 'Gaming');
// 'lifestyle' tiene copy curado en CATEGORY_COPY: localizeCategory reemplaza
// nombre y descripción, así que sirve para verificar la localización real.
const LIFESTYLE = { ...category('lifestyle', 'Lifestyle'), description: 'Stored English tagline.' };

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    slug: 'quiz-1',
    title: 'Quiz de prueba',
    description: null,
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    questions: [],
    results: null,
    tags: [],
    estimated_minutes: 4,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: null,
    created_at: '2026-05-21T00:00:00.000Z',
    category: MOVIES,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  const quizzes = (overrides.quizzes as Quiz[] | undefined) ?? [
    makeQuiz({ id: 'q1', slug: 'trivia-cine', title: 'Trivia de cine' }),
    makeQuiz({
      id: 'q2',
      slug: 'que-personaje-eres',
      title: '¿Qué personaje eres?',
      quiz_type: 'personality',
    }),
  ];
  return {
    category: MOVIES,
    categories: [MOVIES, ANIME, GAMING],
    quizzes,
    totalQuizzes: quizzes.length,
    page: 1,
    pageCount: 1,
    ...overrides,
  };
}

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  const graph = JSON.parse(script!.textContent!) as {
    '@graph': Array<Record<string, unknown>>;
  };
  return graph['@graph'];
}

async function renderPage(slug = 'movies-tv', locale = 'es', query: Record<string, string> = {}) {
  return render(
    await LocalizedCategoryPage({
      params: Promise.resolve({ locale, slug }),
      searchParams: Promise.resolve(query),
    })
  );
}

beforeEach(() => {
  dbMocks.getCategoryPayload.mockReset();
});

describe('LocalizedCategoryPage · render', () => {
  it('pinta h1 con el nombre localizado, la descripción y el conteo', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload());

    await renderPage();

    const localized = localizeCategory(MOVIES, 'es')!;
    expect(screen.getByRole('heading', { level: 1, name: localized.name })).toBeInTheDocument();
    expect(screen.getByText(localized.description!)).toBeInTheDocument();
    expect(screen.getByText('2 juegos mostrados')).toBeInTheDocument();
  });

  it('aplica la localización de nombre y descripción de la categoría', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({ category: LIFESTYLE, categories: [LIFESTYLE, ANIME, GAMING] })
    );

    await render(
      await LocalizedCategoryPage({
        params: Promise.resolve({ locale: 'es', slug: 'lifestyle' }),
        searchParams: Promise.resolve({}),
      })
    );

    const localized = localizeCategory(LIFESTYLE, 'es')!;
    expect(localized.description).not.toBe(LIFESTYLE.description);
    expect(screen.getByRole('heading', { level: 1, name: localized.name })).toBeInTheDocument();
    expect(screen.getByText(localized.description!)).toBeInTheDocument();
    expect(screen.queryByText(LIFESTYLE.description!)).not.toBeInTheDocument();
  });

  it('pinta la guía editorial: intro y FAQ salen de getCategoryGuide', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload());

    await renderPage();

    const guide = getCategoryGuide('movies-tv', 'es', 'Cine y televisión', 2);
    for (const paragraph of guide.intro) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
    for (const item of guide.faq) {
      expect(screen.getByRole('heading', { level: 3, name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });

  it('emite un JSON-LD con WebPage, BreadcrumbList, ItemList y FAQPage', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload());

    const { container } = await renderPage();

    const types = jsonLd(container).map((node) => node['@type']);
    expect(types).toEqual(
      expect.arrayContaining(['WebPage', 'BreadcrumbList', 'ItemList', 'FAQPage'])
    );

    const itemList = jsonLd(container).find((node) => node['@type'] === 'ItemList') as {
      numberOfItems: number;
      itemListElement: Array<{ url: string }>;
    };
    expect(itemList.numberOfItems).toBe(2);
    expect(itemList.itemListElement[0].url).toContain('/es/quiz/trivia-cine');
  });

  it('el ItemList del JSON-LD se recorta a 24 aunque la categoría tenga más', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({
        quizzes: Array.from({ length: 30 }, (_, i) =>
          makeQuiz({ id: `q${i}`, slug: `quiz-${i}`, title: `Quiz ${i}` })
        ),
      })
    );

    const { container } = await renderPage();

    const itemList = jsonLd(container).find((node) => node['@type'] === 'ItemList') as {
      numberOfItems: number;
      itemListElement: Array<unknown>;
    };
    expect(itemList.numberOfItems).toBeLessThanOrEqual(24);
    expect(itemList.itemListElement).toHaveLength(24);
  });

  it('cada quiz de la carga enlaza a /{locale}/quiz/{slug}', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload());

    await renderPage();

    for (const [slug, title] of [
      ['trivia-cine', 'Trivia de cine'],
      ['que-personaje-eres', '¿Qué personaje eres?'],
    ]) {
      const link = screen.getByRole('link', { name: new RegExp(title) });
      expect(link).toHaveAttribute('href', `/es/quiz/${slug}`);
    }
  });

  it('el nav lista las categorías y marca la actual con aria-current', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload());

    await renderPage();

    const nav = screen.getByRole('navigation', { name: 'Atajos de categorías' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/es/quiz',
      '/es/category/movies-tv',
      '/es/category/anime-manga',
      '/es/category/gaming',
    ]);

    const current = links.find((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveAttribute('href', '/es/category/movies-tv');
    expect(current).toHaveTextContent('Cine y televisión');
    for (const link of links.filter((item) => item !== current)) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('sin payload o sin quizzes dispara notFound()', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(null);
    await expect(
      LocalizedCategoryPage({
        params: Promise.resolve({ locale: 'es', slug: 'nope' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('notFound');

    dbMocks.getCategoryPayload.mockResolvedValue(payload({ quizzes: [] }));
    await expect(
      LocalizedCategoryPage({
        params: Promise.resolve({ locale: 'es', slug: 'movies-tv' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('notFound');
  });
});

describe('LocalizedCategoryPage · paginación', () => {
  const manyQuizzes = Array.from({ length: 36 }, (_, index) =>
    makeQuiz({ id: `q${index}`, slug: `quiz-${index}`, title: `Quiz ${index}` })
  );

  it('la página 1 enlaza a la 2 con ?page y no muestra anterior', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({ quizzes: manyQuizzes, totalQuizzes: 100, page: 1, pageCount: 3 })
    );

    await renderPage();

    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent(
      'Página 1 / 3'
    );
    expect(screen.getByRole('link', { name: /Siguiente/ })).toHaveAttribute(
      'href',
      '/es/category/movies-tv?page=2'
    );
    expect(screen.queryByRole('link', { name: /Anterior/ })).not.toBeInTheDocument();
  });

  it('la página intermedia enlaza anterior a la URL limpia y siguiente con ?page', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({ quizzes: manyQuizzes, totalQuizzes: 100, page: 2, pageCount: 3 })
    );

    await renderPage('movies-tv', 'es', { page: '2' });

    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'href',
      '/es/category/movies-tv'
    );
    expect(screen.getByRole('link', { name: /Siguiente/ })).toHaveAttribute(
      'href',
      '/es/category/movies-tv?page=3'
    );
  });

  it('la última página no muestra siguiente', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({ quizzes: manyQuizzes, totalQuizzes: 100, page: 3, pageCount: 3 })
    );

    await renderPage('movies-tv', 'es', { page: '3' });

    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'href',
      '/es/category/movies-tv?page=2'
    );
    expect(screen.queryByRole('link', { name: /Siguiente/ })).not.toBeInTheDocument();
  });

  it('una página fuera de rango dispara notFound()', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({ quizzes: [], totalQuizzes: 100, page: 4, pageCount: 3 })
    );

    await expect(
      LocalizedCategoryPage({
        params: Promise.resolve({ locale: 'es', slug: 'movies-tv' }),
        searchParams: Promise.resolve({ page: '4' }),
      })
    ).rejects.toThrow('notFound');
  });

  it('un ?page que no es entero positivo dispara notFound() sin consultar', async () => {
    for (const page of ['0', '-1', 'abc', '2.5']) {
      await expect(
        LocalizedCategoryPage({
          params: Promise.resolve({ locale: 'es', slug: 'movies-tv' }),
          searchParams: Promise.resolve({ page }),
        })
      ).rejects.toThrow('notFound');
    }
    expect(dbMocks.getCategoryPayload).not.toHaveBeenCalled();
  });
});
