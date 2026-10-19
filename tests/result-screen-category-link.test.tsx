import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { ResultScreen } from '@/components/quiz/result-screen';
import type { Category, Quiz } from '@/types/quiz';

const MOVIES_CATEGORY: Category = {
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
    slug: 'space-trivia',
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the most moons?',
        options: [
          { id: 'q1a', text: 'Saturn' },
          { id: 'q1b', text: 'Mars' },
        ],
      },
    ],
    results: null,
    tags: ['space'],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: '2026-05-21T00:00:00.000Z',
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function renderResult(props: { locale?: 'en' | 'es'; quiz?: Quiz; related?: Quiz[] } = {}) {
  return render(
    <ResultScreen
      locale={props.locale ?? 'en'}
      quiz={props.quiz ?? makeQuiz({ category: MOVIES_CATEGORY })}
      result={null}
      answers={[]}
      related={props.related}
    />
  );
}

describe('ResultScreen · enlace al hub de categoría', () => {
  it('pinta exactamente un enlace a /en/category/movies-tv con categoría', () => {
    renderResult({ related: [makeQuiz({ id: 'r1', slug: 'rel-1', title: 'Rel 1' })] });

    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/en/category/movies-tv');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('See all Movies & TV quizzes');
  });

  it('localiza href y texto en español', () => {
    renderResult({ locale: 'es', quiz: makeQuiz({ category: MOVIES_CATEGORY }) });

    const link = screen.getByRole('link', { name: /ver todos los quizzes de movies & tv/i });
    expect(link).toHaveAttribute('href', '/es/category/movies-tv');
  });

  it('pinta el enlace aunque no haya relacionados', () => {
    renderResult();

    expect(screen.getByRole('link', { name: /see all movies & tv quizzes/i })).toHaveAttribute(
      'href',
      '/en/category/movies-tv'
    );
  });

  it('no pinta el enlace sin categoría y el resto sigue renderizando', () => {
    renderResult({
      quiz: makeQuiz({ category: null }),
      related: [makeQuiz({ id: 'r1', slug: 'rel-1', title: 'Rel 1' })],
    });

    expect(screen.queryByRole('link', { name: /see all .* quizzes/i })).not.toBeInTheDocument();
    // El resto de la pantalla sigue en pie: compartir, ranking y relacionados.
    expect(screen.getByRole('button', { name: 'Share result' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View ranking ↗' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Keep playing' })).toBeInTheDocument();
  });
});
