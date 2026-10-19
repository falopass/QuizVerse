import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Question } from '@/types/quiz';
import { QuestionCard } from '@/components/quiz/question-card';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    question: '¿Capital de Chile?',
    options: [
      { id: 'o1', text: 'Santiago' },
      { id: 'o2', text: 'Lima' },
    ],
    explanation: 'Santiago es la capital de Chile.',
    ...overrides,
  };
}

const BASE_PROPS = {
  questionNumber: 1,
  totalQuestions: 5,
  onSelectOption: () => {},
  locale: 'es' as const,
};

// La región viva es un div con aria-live, sin role="status": quiz-player ya
// reserva los roles status para progreso, marcador y veredicto.
function liveRegion(container: HTMLElement) {
  const region = container.querySelector('[aria-live="polite"]');
  expect(region).not.toBeNull();
  return region as HTMLElement;
}

describe('QuestionCard — anuncio del veredicto (A11Y-04)', () => {
  it('anuncia acierto y explicación con showFeedback y respuesta correcta', () => {
    const { container } = render(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion()}
        selectedOptionId="o1"
        showFeedback
        correctOptionId="o1"
        showExplanation
      />
    );

    const status = liveRegion(container);
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveTextContent('Correcto.');
    expect(status).toHaveTextContent('Santiago es la capital de Chile.');
  });

  it('anuncia fallo con showFeedback y respuesta incorrecta', () => {
    const { container } = render(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion()}
        selectedOptionId="o2"
        showFeedback
        correctOptionId="o1"
      />
    );

    expect(liveRegion(container)).toHaveTextContent('Incorrecto.');
  });

  it('sin showFeedback la región existe pero queda vacía', () => {
    const { container } = render(
      <QuestionCard {...BASE_PROPS} question={makeQuestion()} selectedOptionId={null} />
    );

    expect(liveRegion(container)).toBeEmptyDOMElement();
  });

  it('al cambiar de pregunta se anuncia el veredicto de la nueva', () => {
    const { container, rerender } = render(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion()}
        selectedOptionId="o1"
        showFeedback
        correctOptionId="o1"
      />
    );
    expect(liveRegion(container)).toHaveTextContent('Correcto.');

    rerender(
      <QuestionCard
        {...BASE_PROPS}
        question={makeQuestion({
          id: 'q2',
          question: '¿Capital de Perú?',
          explanation: 'Lima es la capital de Perú.',
        })}
        selectedOptionId="o1"
        showFeedback
        correctOptionId="o2"
      />
    );

    const status = liveRegion(container);
    expect(status).toHaveTextContent('Incorrecto.');
    expect(status).toHaveTextContent('Lima es la capital de Perú.');
    expect(status).not.toHaveTextContent('Santiago es la capital de Chile.');
  });
});
