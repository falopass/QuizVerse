'use client';

import type { Ref } from 'react';
import { cn } from '@/lib/utils/cn';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Question } from '@/types/quiz';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  showExplanation?: boolean;
  showFeedback?: boolean;
  /**
   * Id of the right option, revealed by the server for the answer just given.
   * The card never reads `option.is_correct`: that field does not reach the
   * browser.
   */
  correctOptionId?: string | null;
  disabled?: boolean;
  locale: Locale;
  hiddenOptionIds?: string[];
  /**
   * Ref for the question heading: the card remounts on every question change,
   * so the player uses it to move focus to the new heading.
   */
  headingRef?: Ref<HTMLHeadingElement>;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  showExplanation = false,
  showFeedback = false,
  correctOptionId = null,
  disabled = false,
  locale,
  hiddenOptionIds = [],
  headingRef,
}: QuestionCardProps) {
  const es = locale === 'es';
  // The verdict is announced once, in this live region: the per-option badges
  // already live inside each button's accessible name.
  const showVerdict = showFeedback && correctOptionId !== null;
  const verdictWasCorrect = selectedOptionId !== null && selectedOptionId === correctOptionId;
  return (
    <article className="arcade-question">
      {showVerdict && (
        <span className="arcade-answer-feedback" role="status" aria-live="polite">
          {verdictWasCorrect ? (es ? 'Correcto' : 'Correct') : es ? 'Fallaste' : 'Miss'}
        </span>
      )}
      <div className="arcade-question-head">
        <span>
          {es ? 'PREGUNTA' : 'QUESTION'} {String(questionNumber).padStart(2, '0')} /{' '}
          {String(totalQuestions).padStart(2, '0')}
        </span>
        <span>{es ? 'ELIGE UNA RESPUESTA' : 'CHOOSE AN ANSWER'}</span>
      </div>
      <h2 ref={headingRef} tabIndex={-1}>
        {question.question}
      </h2>
      {question.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.image_url}
          alt={es ? 'Ilustración de la pregunta' : 'Question illustration'}
          className="arcade-question-image"
        />
      )}
      <div className="arcade-options">
        {question.options.map((option, index) => {
          const selected = selectedOptionId === option.id;
          const correct = showFeedback && correctOptionId === option.id;
          const incorrect =
            showFeedback && selected && correctOptionId !== null && correctOptionId !== option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectOption(option.id)}
              disabled={disabled || hiddenOptionIds.includes(option.id)}
              aria-pressed={selected}
              className={cn(
                'arcade-option',
                selected && 'arcade-option-selected',
                correct && 'arcade-option-correct',
                incorrect && 'arcade-option-incorrect',
                hiddenOptionIds.includes(option.id) && 'arcade-option-hidden'
              )}
            >
              <span className="arcade-option-letter">{String.fromCharCode(65 + index)}</span>
              <span>{option.text}</span>
              {correct && (
                <span className="arcade-option-state">{es ? 'CORRECTA' : 'CORRECT'}</span>
              )}
              {incorrect && (
                <span className="arcade-option-state">{es ? 'INCORRECTA' : 'INCORRECT'}</span>
              )}
            </button>
          );
        })}
      </div>
      {showExplanation && showFeedback && question.explanation && (
        <div className="arcade-explanation">
          <strong>{es ? 'EXPLICACIÓN' : 'EXPLANATION'}</strong>
          <p>{question.explanation}</p>
        </div>
      )}
    </article>
  );
}
