import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/actions/quiz.actions', () => ({
  submitQuizResult: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('@/lib/quiz/reveal-client', () => ({
  requestAnswerVerdict: vi.fn(),
  requestEliminatedOptions: vi.fn(),
}));

vi.mock('@/lib/telemetry/client', () => ({ trackEvent: vi.fn() }));

vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { requestAnswerVerdict } from '@/lib/quiz/reveal-client';
import { QuizPlayer } from '@/components/quiz/quiz-player';
import { useQuizStore } from '@/stores/quiz-store';
import type { Quiz } from '@/types/quiz';

function makeQuiz(): Quiz {
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
  };
}

beforeAll(() => {
  // framer-motion cachea esta consulta al primer render del archivo.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

beforeEach(() => {
  vi.mocked(requestAnswerVerdict).mockReset().mockResolvedValue({
    isCorrect: true,
    correctOptionId: 'q1a',
    explanation: null,
  });
  useQuizStore.getState().startGame(makeQuiz());
});

describe('QuizPlayer con prefers-reduced-motion', () => {
  it('no auto-avanza el feedback: el jugador avanza con «Siguiente»', async () => {
    vi.useFakeTimers();
    try {
      render(<QuizPlayer quiz={makeQuiz()} locale="en" />);
      await act(async () => {});

      fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
      await act(async () => {});

      expect(screen.getByText('Correct')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(useQuizStore.getState().currentQuestionIndex).toBe(0);
      expect(
        screen.getByRole('heading', { name: 'Which planet has the most moons?' })
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
