import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { QuizProgress } from '@/components/quiz/quiz-progress';

describe('QuizProgress', () => {
  it('muestra la pregunta actual sobre el total y avanza la barra', () => {
    const { container } = render(
      <QuizProgress currentQuestion={3} totalQuestions={10} locale="en" />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Question 3 of 10');
    expect(screen.getByRole('status')).toHaveClass('font-semibold');
    expect(screen.getByRole('status')).not.toHaveClass('uppercase');

    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '3');
    expect(bars[0]).toHaveAttribute('aria-valuemax', '10');
    expect(bars[0].firstElementChild).toHaveStyle({ width: '30%' });
  });

  it('usa las etiquetas en español', () => {
    render(<QuizProgress currentQuestion={3} totalQuestions={10} locale="es" />);

    expect(screen.getByRole('status')).toHaveTextContent('Pregunta 3 de 10');
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

describe('QuizProgress — marcador en vivo y cronómetro', () => {
  it('pinta el marcador de aciertos y el cronómetro cuando llegan', () => {
    render(
      <QuizProgress
        currentQuestion={5}
        totalQuestions={10}
        correctAnswers={3}
        answeredCount={4}
        elapsedSeconds={65}
        locale="es"
      />
    );

    expect(screen.getByText('3/4 correctas')).toBeInTheDocument();
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('usa las etiquetas en inglés', () => {
    render(
      <QuizProgress
        currentQuestion={5}
        totalQuestions={10}
        correctAnswers={3}
        answeredCount={4}
        elapsedSeconds={600}
        locale="en"
      />
    );

    expect(screen.getByText('3/4 correct')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('no anuncia de nuevo: marcador y reloj quedan fuera del árbol accesible', () => {
    render(
      <QuizProgress
        currentQuestion={5}
        totalQuestions={10}
        correctAnswers={3}
        answeredCount={4}
        elapsedSeconds={65}
        locale="es"
      />
    );

    // Sigue habiendo una sola región status (la de "Pregunta X de Y").
    expect(screen.getAllByRole('status')).toHaveLength(1);
    // El marcador lo anuncia scoreAnnouncement del player → aria-hidden.
    expect(screen.getByText('3/4 correctas')).toHaveAttribute('aria-hidden', 'true');
    // El cronómetro no tiene alternativa: texto plano consultable, no oculto.
    expect(screen.getByText('1:05')).not.toHaveAttribute('aria-hidden');
  });

  it('sin marcador ni cronómetro solo se ve el contador de pregunta', () => {
    render(<QuizProgress currentQuestion={5} totalQuestions={10} locale="es" />);

    expect(screen.queryByText(/correctas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d{2}/)).not.toBeInTheDocument();
  });

  it('el marcador no aparece antes de la primera respuesta', () => {
    render(
      <QuizProgress
        currentQuestion={1}
        totalQuestions={10}
        correctAnswers={0}
        answeredCount={0}
        locale="es"
      />
    );

    expect(screen.queryByText(/correctas/)).not.toBeInTheDocument();
  });
});
