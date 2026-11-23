import React from 'react';
import { describe, expect, it, vi } from 'vitest';
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
import { useQuizStore } from '@/stores/quiz-store';

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

async function startPlaying(
  locale: 'en' | 'es' = 'en',
  initialMode?: 'practice',
  quiz = makeQuiz()
) {
  // /play arranca directo en Clásico: el selector queda tras «Cambiar modo».
  render(<QuizPlayer quiz={quiz} locale={locale} initialMode={initialMode} />);
  await screen.findByText(locale === 'es' ? /Elige una respuesta/ : /Choose an answer/);
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

  it('tras el veredicto el foco llega al enunciado en el auto-avance', async () => {
    await startPlaying('en');

    // Un toque responde: no hace falta confirmar con «Siguiente».
    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    await screen.findByText('Correct', { selector: ':not(.arcade-option-state)' });

    // Auto-avance real: el temporizador de feedback (~3 s) monta la tarjeta
    // nueva tras la animación de salida.
    const nextHeading = await screen.findByRole(
      'heading',
      { name: 'Which planet is closest to the Sun?' },
      { timeout: 8000 }
    );
    await waitFor(() => expect(document.activeElement).toBe(nextHeading));
  });

  it('ignora las teclas 1-4 mientras el veredicto está en vuelo', async () => {
    let resolveReveal!: (verdict: {
      isCorrect: boolean;
      correctOptionId: string;
      explanation: string | null;
    }) => void;
    vi.mocked(requestAnswerVerdict).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReveal = resolve;
        })
    );
    await startPlaying('en');

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));

    // Mientras el servidor decide, la selección no debe cambiar: de lo
    // contrario la tarjeta marcaría incorrecta una opción que no se envió.
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
    resolveReveal({ isCorrect: false, correctOptionId: 'q1b', explanation: null });

    await screen.findByText('Miss');
    expect(screen.getByRole('button', { name: /Incorrect/ })).toHaveAccessibleName(/Saturn/);
  });

  it('descarta un veredicto de una partida anterior tras cambiar de modo', async () => {
    let resolveReveal!: (value: null) => void;
    vi.mocked(requestAnswerVerdict).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReveal = resolve;
        })
    );
    await startPlaying('en');
    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change mode' }));
    fireEvent.click(screen.getByRole('button', { name: /Classic/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Mars/ }));
    await act(async () => resolveReveal(null));

    // El veredicto viejo (null) no pisa la partida nueva: solo cuenta la
    // respuesta enviada después del cambio de modo.
    const state = useQuizStore.getState();
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0].selected_option_id).toBe('q1b');
    expect(state.selectedOptionId).toBe('q1b');
  });
});

describe('QuizPlayer pausa con teclado', () => {
  it('mantiene la pregunta en pausa incluso cuando el veredicto ya lleg\u00f3', async () => {
    vi.useFakeTimers();
    try {
      render(<QuizPlayer quiz={makeQuiz()} locale="en" />);
      await act(async () => {});
      fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));
      await act(async () => {});

      fireEvent.keyDown(window, { key: 'Escape' });
      act(() => vi.advanceTimersByTime(5000));
      expect(useQuizStore.getState().currentQuestionIndex).toBe(0);

      fireEvent.keyDown(window, { key: 'Escape' });
      act(() => vi.advanceTimersByTime(5000));
      expect(useQuizStore.getState().currentQuestionIndex).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([undefined, 'practice'] as const)(
    'devuelve el foco a donde se abri\u00f3 (%s)',
    async (mode) => {
      await startPlaying('en', mode);
      const option = screen.getByRole('button', { name: /Mars/ });
      option.focus();

      fireEvent.keyDown(option, { key: 'Escape' });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toContainElement(document.activeElement as HTMLElement);

      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mars/ })).toHaveFocus();
    }
  );
});

describe('QuizPlayer veredicto accesible', () => {
  it('en Pr\u00e1ctica anuncia un solo veredicto y enfoca Siguiente', async () => {
    vi.mocked(requestAnswerVerdict).mockResolvedValueOnce({
      isCorrect: true,
      correctOptionId: 'q1a',
      explanation: 'Saturno tiene m\u00e1s lunas.',
    });
    await startPlaying('es', 'practice');

    const option = screen.getByRole('button', { name: /Saturn/ });
    option.focus();
    fireEvent.click(option);

    const next = await screen.findByRole('button', { name: 'Siguiente' });
    await waitFor(() => expect(next).toHaveFocus());
    const card = next.ownerDocument.querySelector('article')!;
    const regions = card.querySelectorAll('[aria-live], [role="status"]');
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveTextContent('Correcto');
    expect(regions[0]).toHaveTextContent('Saturno tiene m\u00e1s lunas.');
  });

  it('en la \u00faltima pregunta enfoca Terminar aunque falle el reveal', async () => {
    vi.mocked(requestAnswerVerdict).mockResolvedValueOnce(null);
    await startPlaying('es', 'practice', makeQuiz({ questions: makeQuiz().questions.slice(0, 1) }));
    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));

    const finish = screen.getByRole('button', { name: 'Terminar' });
    await waitFor(() => expect(finish).toHaveFocus());
    expect(finish).toBeEnabled();
  });

  it('un fallo también se anuncia en role="status" y la opción elegida lo marca en su nombre', async () => {
    vi.mocked(requestAnswerVerdict).mockResolvedValueOnce({
      isCorrect: false,
      correctOptionId: 'q1b',
      explanation: null,
    });
    await startPlaying('es');

    fireEvent.click(screen.getByRole('button', { name: /Saturn/ }));

    const verdict = await screen.findByText('Fallaste');
    expect(verdict.closest('[role="status"]')).not.toBeNull();

    // La marca visual sigue siendo parte del nombre accesible del botón.
    expect(screen.getByRole('button', { name: /Incorrecta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\bCorrecta/ })).toBeInTheDocument();
  });
});
