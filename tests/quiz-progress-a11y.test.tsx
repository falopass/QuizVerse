import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/actions/quiz.actions', () => ({
  submitQuizResult: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('@/lib/quiz/reveal-client', () => ({
  requestAnswerVerdict: vi
    .fn()
    .mockResolvedValue({ isCorrect: true, correctOptionId: 'q1a' }),
  requestEliminatedOptions: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/telemetry/client', () => ({ trackEvent: vi.fn() }));

vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { QuizProgress } from '@/components/quiz/quiz-progress';
import { QuizPlayer } from '@/components/quiz/quiz-player';
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
      {
        id: 'q2',
        question: 'Which planet is closest to the Sun?',
        options: [
          { id: 'q2a', text: 'Mercury' },
          { id: 'q2b', text: 'Venus' },
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

describe('QuizProgress a11y', () => {
  it('anuncia el avance en una región viva polite que cambia de pregunta (es)', () => {
    const { rerender } = render(
      <QuizProgress currentQuestion={1} totalQuestions={3} locale="es" />
    );
    const region = screen.getByRole('status');

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveTextContent('PREGUNTA 1 DE 3');

    rerender(<QuizProgress currentQuestion={2} totalQuestions={3} locale="es" />);
    expect(screen.getByRole('status')).toHaveTextContent('PREGUNTA 2 DE 3');
  });

  it('anuncia el avance en una región viva polite que cambia de pregunta (en)', () => {
    const { rerender } = render(
      <QuizProgress currentQuestion={1} totalQuestions={3} locale="en" />
    );
    const region = screen.getByRole('status');

    expect(region).toHaveTextContent('QUESTION 1 OF 3');

    rerender(<QuizProgress currentQuestion={2} totalQuestions={3} locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent('QUESTION 2 OF 3');
  });
});

describe('QuizPlayer a11y', () => {
  async function startPlaying(locale: 'en' | 'es') {
    render(<QuizPlayer quiz={makeQuiz()} locale={locale} />);
    fireEvent.click(screen.getByRole('button', { name: /Clásico|Classic/ }));
    return screen.findByText(locale === 'es' ? /ELIGE UNA RESPUESTA/ : /CHOOSE AN ANSWER/);
  }

  it('el marcador se anuncia en su propia región viva, separada del veredicto', async () => {
    await startPlaying('es');

    // En juego hay dos regiones: progreso y marcador. Ninguna repite el veredicto.
    let regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    // Con el veredicto visible hay tres regiones y solo una anuncia "Correcto".
    await screen.findByText('Correcto');
    regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(3);
    expect(regions.filter((r) => r.textContent?.includes('Correcto'))).toHaveLength(1);
    expect(regions.some((r) => r.textContent?.includes('1 de 1 correctas'))).toBe(true);
  });

  it('anuncia el marcador en inglés', async () => {
    await startPlaying('en');

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Correct');
    const regions = screen.getAllByRole('status');
    expect(regions.filter((r) => r.textContent?.includes('Correct'))).toHaveLength(1);
    expect(regions.some((r) => r.textContent?.includes('1 of 1 correct'))).toBe(true);
  });
});
