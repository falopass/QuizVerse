import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import type { Category, Quiz } from '@/types/quiz';
import { SITE_URL } from '@/lib/seo/site';
import { generateCategoryMetadata } from '@/lib/seo/metadata';

const dbMocks = vi.hoisted(() => ({
  getCategoryPayload: vi.fn(),
  translatedHubExists: vi.fn(),
  translatedHubPageExists: vi.fn(),
}));

vi.mock('@/lib/data/public', () => dbMocks);
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import { generateMetadata } from '@/app/[locale]/category/[slug]/page';

const MOVIES: Category = {
  id: 'cat-movies',
  name: 'Movies & TV',
  slug: 'movies-tv',
  description: 'Tests de cine y series.',
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 262,
  sort_order: 0,
};

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
  const quizzes = (overrides.quizzes as Quiz[] | undefined) ?? [makeQuiz()];
  return {
    category: MOVIES,
    categories: [MOVIES],
    quizzes,
    totalQuizzes: 262,
    page: 1,
    pageCount: 8,
    ...overrides,
  };
}

function titleText(metadata: Metadata): string {
  const title = metadata.title;
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object' && 'absolute' in title) return title.absolute;
  return '';
}

function canonical(metadata: Metadata): string {
  return String(metadata.alternates?.canonical);
}

beforeEach(() => {
  dbMocks.getCategoryPayload.mockReset();
  dbMocks.translatedHubExists.mockReset().mockResolvedValue(true);
  dbMocks.translatedHubPageExists.mockReset().mockResolvedValue(true);
});

describe('generateCategoryMetadata · paginación', () => {
  it('la página 1 canonicaliza a la URL limpia y mantiene el título sin sufijo', () => {
    const metadata = generateCategoryMetadata({
      name: 'Movies & TV',
      slug: 'movies-tv',
      locale: 'en',
      quizCount: 262,
      translatedHubExists: true,
    });

    expect(canonical(metadata)).toBe(`${SITE_URL}/en/category/movies-tv`);
    expect(titleText(metadata)).toBe('Movies & TV: 262 quizzes to play');
    expect(metadata.robots).toEqual(expect.objectContaining({ index: true }));
  });

  it('la página 2 se canonicaliza a sí misma, con hreflang a su equivalente', () => {
    const metadata = generateCategoryMetadata({
      name: 'Movies & TV',
      slug: 'movies-tv',
      locale: 'en',
      quizCount: 262,
      translatedHubExists: true,
      page: 2,
    });

    expect(canonical(metadata)).toBe(`${SITE_URL}/en/category/movies-tv?page=2`);
    expect(metadata.alternates?.languages).toEqual({
      en: `${SITE_URL}/en/category/movies-tv?page=2`,
      es: `${SITE_URL}/es/category/movies-tv?page=2`,
      'x-default': `${SITE_URL}/en/category/movies-tv?page=2`,
    });
    expect(titleText(metadata)).toContain('page 2');
    expect(metadata.robots).toEqual(expect.objectContaining({ index: true }));
  });

  it('sin hermana en la página N no emite hreflang', () => {
    const metadata = generateCategoryMetadata({
      name: 'Historia',
      slug: 'history',
      locale: 'es',
      quizCount: 90,
      page: 3,
    });

    expect(canonical(metadata)).toBe(`${SITE_URL}/es/category/history?page=3`);
    expect(metadata.alternates?.languages).toEqual({
      es: `${SITE_URL}/es/category/history?page=3`,
      'x-default': `${SITE_URL}/es/category/history?page=3`,
    });
    expect(titleText(metadata)).toContain('página 3');
  });
});

describe('generateMetadata · categoría paginada', () => {
  it('pide la página 2 y la canonicaliza con ?page=2', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(
      payload({ page: 2, quizzes: [makeQuiz({ slug: 'quiz-2' })] })
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'movies-tv' }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(dbMocks.getCategoryPayload).toHaveBeenCalledWith('movies-tv', 'en', 2);
    expect(dbMocks.translatedHubPageExists).toHaveBeenCalledWith('movies-tv', 'es', 2);
    expect(canonical(metadata)).toBe(`${SITE_URL}/en/category/movies-tv?page=2`);
    expect(titleText(metadata)).toContain('page 2');
  });

  it('la página 1 usa la sonda estricta de siempre y la URL limpia', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload());

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'movies-tv' }),
      searchParams: Promise.resolve({}),
    });

    expect(dbMocks.getCategoryPayload).toHaveBeenCalledWith('movies-tv', 'en', 1);
    expect(dbMocks.translatedHubExists).toHaveBeenCalledWith('movies-tv', 'es');
    expect(dbMocks.translatedHubPageExists).not.toHaveBeenCalled();
    expect(canonical(metadata)).toBe(`${SITE_URL}/en/category/movies-tv`);
  });

  it('una página fuera de rango devuelve el título de no encontrado', async () => {
    dbMocks.getCategoryPayload.mockResolvedValue(payload({ quizzes: [] }));

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'movies-tv' }),
      searchParams: Promise.resolve({ page: '9' }),
    });

    expect(titleText(metadata)).toBe('Page not found');
  });

  it('un ?page inválido no consulta el payload', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', slug: 'movies-tv' }),
      searchParams: Promise.resolve({ page: 'abc' }),
    });

    expect(titleText(metadata)).toBe('Page not found');
    expect(dbMocks.getCategoryPayload).not.toHaveBeenCalled();
  });
});
