/**
 * Tests de SEO-23: la ficha enlaza el hub de su categoría de tema.
 *
 * Las fichas solo enlazaban el hub de tipo (`/category/trivia`) en el
 * breadcrumb; los hubs de tema del sitemap (`/category/movies-tv`, …) no
 * recibían enlaces desde el tipo de página más numeroso. Estas pruebas fijan
 * el enlace de `arcade-facts` y el «Ver todos» de la sección de relacionados,
 * ambos a `/{locale}/category/{slug}`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Category, Quiz } from '@/types/quiz';

const dbMocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getRelatedQuizzes: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getPublishedQuizzes: vi.fn(),
  getQuizBySlug: dbMocks.getQuizBySlug,
  getRelatedQuizzes: dbMocks.getRelatedQuizzes,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

// QuizComments monta el provider de Supabase; no participa en el enlazado.
vi.mock('@/components/quiz/quiz-comments', () => ({
  QuizComments: () => null,
}));

import { QuizDetailPage } from '@/components/home/quiz-detail-page';

const MOVIES: Category = {
  id: 'cat-movies',
  name: 'Movies & TV',
  slug: 'movies-tv',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 174,
  sort_order: 0,
};

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'movies-trivia',
    title: 'Movies Trivia',
    description: 'A trivia quiz about movies.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'es',
    questions: [
      {
        id: 'q1',
        question: '¿Qué película ganó el Óscar en 2020?',
        options: [
          { id: 'q1a', text: 'Parasite' },
          { id: 'q1b', text: '1917' },
        ],
      },
    ],
    results: null,
    tags: ['movies'],
    estimated_minutes: 3,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    created_at: '2026-05-21T00:00:00.000Z',
    category: MOVIES,
    ...overrides,
  };
}

beforeEach(() => {
  dbMocks.getQuizBySlug.mockReset();
  dbMocks.getRelatedQuizzes.mockReset();
});

describe('QuizDetailPage · enlace a la categoría de tema', () => {
  it('enlaza la categoría en los datos y al final de relacionados', async () => {
    dbMocks.getQuizBySlug.mockResolvedValue(makeQuiz());
    dbMocks.getRelatedQuizzes.mockResolvedValue([
      makeQuiz({ id: 'rel-1', slug: 'rel-1', title: 'Related One' }),
    ]);

    render(
      await QuizDetailPage({
        params: Promise.resolve({ locale: 'es', slug: 'movies-trivia' }),
      })
    );

    // La fila Categoría enlaza el hub con el nombre localizado.
    const factLink = screen.getByRole('link', { name: 'Cine y televisión' });
    expect(factLink).toHaveAttribute('href', '/es/category/movies-tv');

    // El «Ver todos» cierra la sección de relacionados.
    const seeAll = screen.getByRole('link', {
      name: /Ver todos los quizzes de Cine y televisión/,
    });
    expect(seeAll).toHaveAttribute('href', '/es/category/movies-tv');

    // Exactamente los dos enlaces nuevos al hub de tema (el breadcrumb solo
    // enlaza el hub de tipo, /es/category/trivia).
    const hubLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/es/category/movies-tv');
    expect(hubLinks).toHaveLength(2);
  });

  it('pinta el «Ver todos» aunque no haya relacionados', async () => {
    dbMocks.getQuizBySlug.mockResolvedValue(makeQuiz());
    dbMocks.getRelatedQuizzes.mockResolvedValue([]);

    render(
      await QuizDetailPage({
        params: Promise.resolve({ locale: 'es', slug: 'movies-trivia' }),
      })
    );

    expect(
      screen.getByRole('link', { name: /Ver todos los quizzes de Cine y televisión/ })
    ).toHaveAttribute('href', '/es/category/movies-tv');
  });

  it('sin categoría no hay enlaces al hub de tema y la ficha renderiza', async () => {
    dbMocks.getQuizBySlug.mockResolvedValue(makeQuiz({ category: null }));
    dbMocks.getRelatedQuizzes.mockResolvedValue([]);

    render(
      await QuizDetailPage({
        params: Promise.resolve({ locale: 'es', slug: 'movies-trivia' }),
      })
    );

    expect(screen.getByRole('heading', { name: 'Movies Trivia' })).toBeInTheDocument();
    expect(screen.queryByText('Categoría')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Ver todos los quizzes de/ })
    ).not.toBeInTheDocument();
    expect(
      screen
        .queryAllByRole('link')
        .some((link) => link.getAttribute('href') === '/es/category/movies-tv')
    ).toBe(false);
  });
});
