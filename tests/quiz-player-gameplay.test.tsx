import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/actions/quiz.actions', () => ({
  startQuizAttempt: vi.fn().mockResolvedValue({
    success: true,
    attempt: 'test-attempt',
    expiresAt: 9_999_999_999,
  }),
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

// El resultado lanza confetti; aquí solo importa el foco y el contenido.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { startQuizAttempt, submitQuizResult } from '@/actions/quiz.actions';
import { requestAnswerVerdict, requestEliminatedOptions } from '@/lib/quiz/reveal-client';
import { trackEvent } from '@/lib/telemetry/client';
import { parseInitialGameMode } from '@/lib/quiz/game-modes';
import { QuizPlayer } from '@/components/quiz/quiz-player';
import { useQuizStore } from '@/stores/quiz-store';
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
        explanation: 'Saturn leads the moon count.',
        time_limit_seconds: 31,
        options: [
          { id: 'q1a', text: 'Saturn' },
          { id: 'q1b', text: 'Mars' },
        ],
      },
      {
        id: 'q2',
        question: 'Which planet is closest to the Sun?',
        explanation: 'Mercury orbits closest.',
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

beforeAll(() => {
  // jsdom no trae matchMedia y el resultado lo consulta antes del confetti.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

beforeEach(() => {
  vi.mocked(requestAnswerVerdict).mockReset().mockResolvedValue({
    isCorrect: true,
    correctOptionId: 'q1a',
    explanation: 'Saturn leads the moon count.',
  });
  vi.mocked(requestEliminatedOptions).mockReset().mockResolvedValue(null);
  vi.mocked(startQuizAttempt).mockClear();
  vi.mocked(submitQuizResult).mockClear();
  vi.mocked(trackEvent).mockClear();
  useQuizStore.getState().startGame(makeQuiz());
});

describe('QuizPlayer · un toque responde', () => {
  it('tocar una opción la envía y «Siguiente» avanza tras el feedback', async () => {
    render(<QuizPlayer quiz={makeQuiz()} locale="en" />);
    await screen.findByText(/CHOOSE AN ANSWER/);

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));

    await screen.findByText('Correct');
    expect(requestAnswerVerdict).toHaveBeenCalledWith({
      quizId: makeQuiz().id,
      questionId: 'q1',
      selectedOptionId: 'q1a',
      attempt: 'test-attempt',
    });

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeEnabled();
    fireEvent.click(next);

    await screen.findByRole('heading', { name: 'Which planet is closest to the Sun?' });
  });

  it('el atajo 1-4 también responde sin pasar por «Siguiente»', async () => {
    render(<QuizPlayer quiz={makeQuiz()} locale="en" />);
    await screen.findByText(/CHOOSE AN ANSWER/);

    fireEvent.keyDown(window, { key: '2' });

    await screen.findByText('Correct');
    expect(requestAnswerVerdict).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOptionId: 'q1b' })
    );
  });

  it('sin attempt disponible pide el veredicto igual: el servidor decide el modo', async () => {
    vi.mocked(startQuizAttempt).mockResolvedValueOnce({
      success: false,
      code: 'unavailable',
      error: 'Game attempts are not configured.',
    });
    render(<QuizPlayer quiz={makeQuiz()} locale="en" />);
    await screen.findByText(/CHOOSE AN ANSWER/);

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));

    // En modo degradado el servidor responde sin token: el jugador conserva
    // el feedback aunque startQuizAttempt haya devuelto `unavailable`.
    await screen.findByText('Correct');
    expect(requestAnswerVerdict).toHaveBeenCalledWith({
      quizId: makeQuiz().id,
      questionId: 'q1',
      selectedOptionId: 'q1a',
      attempt: undefined,
    });
  });
});

describe('QuizPlayer · Práctica sin prisa', () => {
  it('no auto-avanza el feedback y espera a «Siguiente»', async () => {
    vi.useFakeTimers();
    try {
      render(<QuizPlayer quiz={makeQuiz()} locale="en" initialMode="practice" />);
      await act(async () => {});

      fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
      await act(async () => {});

      expect(screen.getByText('Correct')).toBeInTheDocument();
      expect(screen.getByText('Saturn leads the moon count.')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      // La explicación sigue en pantalla: nada se mueve solo.
      expect(useQuizStore.getState().currentQuestionIndex).toBe(0);
      expect(
        screen.getByRole('heading', { name: 'Which planet has the most moons?' })
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('QuizPlayer · personalidad', () => {
  it('no ofrece «Cambiar modo» y arranca en Clásico aunque la URL pida otro', async () => {
    const personality = makeQuiz({
      quiz_type: 'personality',
      results: [
        { id: 'r1', title: 'Dreamer', description: 'Imaginative.', personality_tag: 'dreamer' },
      ],
    });
    // Mismo parseo que hace la página /play con `?mode=timed`.
    render(
      <QuizPlayer
        quiz={personality}
        locale="en"
        initialMode={parseInitialGameMode('timed', personality)}
      />
    );
    await screen.findByText(/CHOOSE AN ANSWER/);

    expect(screen.queryByRole('button', { name: 'Change mode' })).not.toBeInTheDocument();
    expect(useQuizStore.getState().gameMode).toBe('normal');
  });
});

describe('QuizPlayer · temporizador accesible', () => {
  it('nombra la barra de tiempo y anuncia solo los hitos', async () => {
    vi.useFakeTimers();
    try {
      render(<QuizPlayer quiz={makeQuiz()} locale="en" initialMode="timed" />);
      await act(async () => {});

      const timer = screen.getByRole('progressbar', { name: 'Time remaining' });
      expect(timer).toHaveAttribute('aria-valuetext', '1:01');

      act(() => {
        vi.advanceTimersByTime(31_000);
      });

      expect(useQuizStore.getState().timeRemaining).toBe(30);
      expect(screen.getByText('30 seconds left')).toBeInTheDocument();
      // No se anuncia cada segundo: solo hay un mensaje vivo a la vez.
      expect(screen.queryByText('29 seconds left')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('QuizPlayer · pausa accesible', () => {
  it('abre un diálogo modal con foco atrapado, Escape y retorno del foco', async () => {
    render(<QuizPlayer quiz={makeQuiz()} locale="es" />);
    await screen.findByText(/ELIGE UNA RESPUESTA/);

    fireEvent.click(screen.getByRole('button', { name: 'Pausar juego' }));

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    const title = screen.getByRole('heading', { name: 'Respira un momento.' });
    await waitFor(() => expect(document.activeElement).toBe(title));

    const resume = screen.getByRole('button', { name: 'Volver' });
    const change = screen.getByRole('button', { name: 'Cambiar modo' });

    change.focus();
    fireEvent.keyDown(change, { key: 'Tab' });
    expect(document.activeElement).toBe(resume);

    fireEvent.keyDown(resume, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(change);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pausar juego' })).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('QuizPlayer · ayudas', () => {
  it('tras el 50/50 el foco pasa a la primera opción disponible y se anuncia', async () => {
    vi.mocked(requestEliminatedOptions).mockResolvedValueOnce(['q1b']);
    render(<QuizPlayer quiz={makeQuiz()} locale="es" />);
    await screen.findByText(/ELIGE UNA RESPUESTA/);

    fireEvent.click(screen.getByRole('button', { name: /50\/50/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Saturn/ })).toHaveFocus());
    // El mock elimina una sola opción: el aviso debe decir una, no dos.
    expect(screen.getByText('Una respuesta eliminada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mars/ })).toBeDisabled();
  });
});

describe('QuizPlayer · resultado', () => {
  it('muestra «Sigue jugando» con relacionados, enfoca el veredicto y «Jugar otro» va al primero', async () => {
    const related = makeQuiz({
      id: 'related-1',
      slug: 'related-quiz',
      title: 'Related Quiz',
    });
    const oneQuestion = makeQuiz({
      questions: [makeQuiz().questions[0]],
    });

    render(<QuizPlayer quiz={oneQuestion} locale="es" related={[related]} />);
    await screen.findByText(/ELIGE UNA RESPUESTA/);

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    await screen.findByText('Correcto');
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    await screen.findByRole('region', { name: 'Sigue jugando' });

    const verdict = screen.getByRole('heading', { level: 1, name: 'Final impecable' });
    await waitFor(() => expect(document.activeElement).toBe(verdict));

    expect(screen.getByRole('link', { name: 'Jugar a otro quiz' })).toHaveAttribute(
      'href',
      '/es/quiz/related-quiz/play?mode=classic'
    );
  });

  it('registra el tiempo real de la partida en cualquier modo', async () => {
    vi.useFakeTimers();
    try {
      const oneQuestion = makeQuiz({ questions: [makeQuiz().questions[0]] });
      render(<QuizPlayer quiz={oneQuestion} locale="en" />);
      await act(async () => {});

      act(() => {
        vi.advanceTimersByTime(42_000);
      });

      fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
      await act(async () => {});
      fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
      await act(async () => {});

      act(() => {
        vi.advanceTimersByTime(0);
      });
      await act(async () => {});

      expect(submitQuizResult).toHaveBeenCalledWith(
        oneQuestion.id,
        expect.any(Array),
        42,
        'test-attempt'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('no pierde la partida si la pestaña queda abierta más de dos horas', async () => {
    vi.useFakeTimers();
    try {
      const oneQuestion = makeQuiz({ questions: [makeQuiz().questions[0]] });
      render(<QuizPlayer quiz={oneQuestion} locale="en" />);
      await act(async () => {});

      act(() => {
        vi.advanceTimersByTime(3 * 60 * 60 * 1000);
      });

      fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
      await act(async () => {});
      fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
      await act(async () => {});

      act(() => {
        vi.advanceTimersByTime(0);
      });
      await act(async () => {});

      // El esquema del servidor rechaza más de 2 h: se envía el tope, no 10800.
      expect(submitQuizResult).toHaveBeenCalledWith(
        oneQuestion.id,
        expect.any(Array),
        7200,
        'test-attempt'
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('QuizPlayer · telemetría', () => {
  it('registra un solo quiz_start al entrar por URL en otro modo', async () => {
    render(<QuizPlayer quiz={makeQuiz()} locale="en" initialMode="timed" />);
    await screen.findByText(/CHOOSE AN ANSWER/);

    const starts = vi
      .mocked(trackEvent)
      .mock.calls.filter(([event]) => (event as { name?: string }).name === 'quiz_start');
    expect(starts).toHaveLength(1);
  });
});
