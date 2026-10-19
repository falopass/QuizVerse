import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { ResultScreen } from '@/components/quiz/result-screen';
import type { Quiz } from '@/types/quiz';

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
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function relatedQuizzes(count: number): Quiz[] {
  return Array.from({ length: count }, (_, index) =>
    makeQuiz({
      id: `related-${index}`,
      slug: `related-quiz-${index}`,
      title: `Related Quiz ${index}`,
      language: 'es',
    })
  );
}

function renderResult(props: { locale?: 'en' | 'es'; related?: Quiz[] } = {}) {
  return render(
    <ResultScreen
      locale={props.locale ?? 'es'}
      quiz={makeQuiz()}
      result={null}
      answers={[]}
      related={props.related}
    />
  );
}

describe('ResultScreen · quizzes relacionados', () => {
  it('muestra «Sigue jugando» con 3 tarjetas en español', () => {
    renderResult({ related: relatedQuizzes(3) });

    const section = screen.getByRole('region', { name: 'Sigue jugando' });
    expect(within(section).getAllByRole('link')).toHaveLength(3);
    expect(within(section).getByRole('heading', { name: 'Related Quiz 0' })).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: 'Related Quiz 2' })).toBeInTheDocument();
  });

  it('usa el titular en inglés', () => {
    renderResult({ locale: 'en', related: relatedQuizzes(1) });

    expect(screen.getByRole('region', { name: 'Keep playing' })).toBeInTheDocument();
  });

  it('aparece aunque solo haya un relacionado', () => {
    renderResult({ related: relatedQuizzes(1) });

    const section = screen.getByRole('region', { name: 'Sigue jugando' });
    expect(within(section).getAllByRole('link')).toHaveLength(1);
  });

  it('recorta a 3 aunque lleguen más', () => {
    renderResult({ related: relatedQuizzes(4) });

    const section = screen.getByRole('region', { name: 'Sigue jugando' });
    expect(within(section).getAllByRole('link')).toHaveLength(3);
    expect(
      within(section).queryByRole('heading', { name: 'Related Quiz 3' })
    ).not.toBeInTheDocument();
  });

  it('no pinta la sección sin la prop o con la lista vacía', () => {
    const { unmount } = renderResult();
    expect(screen.queryByRole('region', { name: 'Sigue jugando' })).not.toBeInTheDocument();
    unmount();

    renderResult({ related: [] });
    expect(screen.queryByRole('region', { name: 'Sigue jugando' })).not.toBeInTheDocument();
  });
});
