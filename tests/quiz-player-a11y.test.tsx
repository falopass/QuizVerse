import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/actions/quiz.actions', () => ({
  submitQuizResult: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('@/lib/quiz/reveal-client', () => ({
  requestAnswerVerdict: vi.fn().mockResolvedValue({ isCorrect: true, correctOptionId: 'q1a' }),
  requestEliminatedOptions: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/telemetry/client', () => ({ trackEvent: vi.fn() }));

vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { requestAnswerVerdict } from '@/lib/quiz/reveal-client';
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
    updated_at: null,
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

async function startPlaying(locale: 'en' | 'es' = 'en') {
  render(<QuizPlayer quiz={makeQuiz()} locale={locale} />);
  fireEvent.click(screen.getByRole('button', { name: /Clásico|Classic/ }));
  await screen.findByText(locale === 'es' ? /ELIGE UNA RESPUESTA/ : /CHOOSE AN ANSWER/);
}

describe('QuizPlayer foco al cambiar de pregunta', () => {
  it('el enunciado nuevo recibe el foco al empezar la partida y al avanzar', async () => {
    await startPlaying('en');

    const firstHeading = screen.getByRole('heading', {
      name: 'Which planet has the most moons?',
    });
    expect(document.activeElement).toBe(firstHeading);

    // Saltar avanza de inmediato: la tarjeta se remonta y el foco no debe caer
    // al <body> ni quedarse en el botón que se pulsó.
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    const nextHeading = await screen.findByRole('heading', {
      name: 'Which planet is closest to the Sun?',
    });
    await waitFor(() => expect(document.activeElement).toBe(nextHeading));
  });
});

describe('QuizPlayer veredicto accesible', () => {
  it('el veredicto se anuncia una sola vez dentro de role="status"', async () => {
    await startPlaying('es');

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    const verdict = await screen.findByText('Correcto');
    expect(verdict.closest('[role="status"]')).not.toBeNull();

    const verdictRegions = screen
      .getAllByRole('status')
      .filter((region) => region.textContent?.includes('Correcto'));
    expect(verdictRegions).toHaveLength(1);
  });

  it('un fallo también se anuncia en role="status" y la opción elegida lo marca en su nombre', async () => {
    vi.mocked(requestAnswerVerdict).mockResolvedValueOnce({
      isCorrect: false,
      correctOptionId: 'q1b',
      explanation: null,
    });
    await startPlaying('es');

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    const verdict = await screen.findByText('Fallaste');
    expect(verdict.closest('[role="status"]')).not.toBeNull();

    // La marca visual sigue siendo parte del nombre accesible del botón.
    expect(screen.getByRole('button', { name: /INCORRECTA/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\bCORRECTA/ })).toBeInTheDocument();
  });
});
