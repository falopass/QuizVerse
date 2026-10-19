import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { QuizProgress } from '@/components/quiz/quiz-progress';

describe('QuizProgress', () => {
  it('muestra la pregunta actual sobre el total y avanza la barra', () => {
    const { container } = render(
      <QuizProgress currentQuestion={3} totalQuestions={10} locale="en" />
    );

    expect(screen.getByRole('status')).toHaveTextContent('QUESTION 3 OF 10');

    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '3');
    expect(bars[0]).toHaveAttribute('aria-valuemax', '10');
    expect(bars[0].firstElementChild).toHaveStyle({ width: '30%' });
  });

  it('usa las etiquetas en español', () => {
    render(<QuizProgress currentQuestion={3} totalQuestions={10} locale="es" />);

    expect(screen.getByRole('status')).toHaveTextContent('PREGUNTA 3 DE 10');
  });

  it('pinta el reloj en mm:ss con ceros a la izquierda', () => {
    const { rerender } = render(
      <QuizProgress
        currentQuestion={3}
        totalQuestions={10}
        timeRemaining={7}
        timeLimit={60}
        locale="en"
      />
    );
    expect(screen.getByText('0:07')).toBeInTheDocument();

    rerender(
      <QuizProgress
        currentQuestion={3}
        totalQuestions={10}
        timeRemaining={65}
        timeLimit={120}
        locale="en"
      />
    );
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('no pinta reloj cuando falta timeRemaining', () => {
    const { container } = render(
      <QuizProgress currentQuestion={3} totalQuestions={10} locale="en" />
    );

    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(screen.queryByText(/\d+:\d{2}/)).not.toBeInTheDocument();
  });
});
