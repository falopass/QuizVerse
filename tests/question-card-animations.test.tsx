import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Question } from '@/types/quiz';
import { QuestionCard } from '@/components/quiz/question-card';

function makeQuestion(): Question {
  return {
    id: 'q1',
    question: '¿Capital de Chile?',
    options: [
      { id: 'o1', text: 'Santiago' },
      { id: 'o2', text: 'Lima' },
      { id: 'o3', text: 'Bogotá' },
    ],
  };
}

const BASE_PROPS = {
  questionNumber: 1,
  totalQuestions: 5,
  onSelectOption: () => {},
  locale: 'es' as const,
};

describe('QuestionCard — animaciones de juego (lote 1)', () => {
  it('las opciones entran escalonadas (~50 ms por opción)', () => {
    render(<QuestionCard {...BASE_PROPS} question={makeQuestion()} selectedOptionId={null} />);

    const options = screen.getAllByRole('button');
    expect(options[0]).toHaveStyle({ animationDelay: '0ms' });
    expect(options[1]).toHaveStyle({ animationDelay: '50ms' });
    expect(options[2]).toHaveStyle({ animationDelay: '100ms' });
    options.forEach((option) => expect(option).toHaveClass('qv-l1-option-in'));
  });

  it('al acertar: pulso en la correcta y veredicto teñido de verde', () => {
    render(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion()}
        selectedOptionId="o1"
        showFeedback
        correctOptionId="o1"
        verdictText="Correcto"
        verdictCorrect
      />
    );

    expect(screen.getByRole('button', { name: /Santiago/ })).toHaveClass('qv-l1-correct-pulse');
    expect(screen.getByText('Correcto')).toHaveClass('qv-l1-verdict-correct');
    // Sin stagger pendiente: el retardo se anula al revelar.
    expect(screen.getByRole('button', { name: /Santiago/ })).toHaveStyle({
      animationDelay: '0ms',
    });
  });

  it('al fallar: shake en la elegida y veredicto teñido de rojo', () => {
    render(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion()}
        selectedOptionId="o2"
        showFeedback
        correctOptionId="o1"
        verdictText="Fallaste"
        verdictCorrect={false}
      />
    );

    expect(screen.getByRole('button', { name: /Lima/ })).toHaveClass('qv-l1-shake');
    expect(screen.getByRole('button', { name: /Santiago/ })).toHaveClass('qv-l1-correct-pulse');
    expect(screen.getByText('Fallaste')).toHaveClass('qv-l1-verdict-incorrect');
  });

  it('sin veredicto confirmado no se tiñe el bloque', () => {
    render(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion()}
        selectedOptionId="o2"
        showFeedback
        verdictText="Fallaste"
        verdictCorrect={null}
      />
    );

    const banner = screen.getByText('Fallaste');
    expect(banner).not.toHaveClass('qv-l1-verdict-correct');
    expect(banner).not.toHaveClass('qv-l1-verdict-incorrect');
  });
});
