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
  isChecking?: boolean;
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
  /**
   * Localized verdict text for the answer just given. It comes from the
   * server's verdict, so it stays truthful even if the visible selection
   * changed after the answer was sent (or the question has no answer key).
   */
  verdictText?: string | null;
  /**
   * Whether the verdict was a hit, straight from the server reveal. Tints the
   * verdict banner (green/red); `null`/undefined leaves it untinted.
   */
  verdictCorrect?: boolean | null;
  /**
   * Explanation for the answer just given, revealed by the server. Once the
   * 015 migration strips `explanation` from public `questions`, the verdict
   * is the only source; `question.explanation` stays as the fallback.
   */
  explanation?: string | null;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  showExplanation = false,
  showFeedback = false,
  isChecking = false,
  correctOptionId = null,
  disabled = false,
  locale,
  hiddenOptionIds = [],
  headingRef,
  verdictText,
  verdictCorrect = null,
  explanation = null,
}: QuestionCardProps) {
  const es = locale === 'es';
  const shownExplanation = explanation ?? question.explanation;
  const fallbackVerdict =
    correctOptionId === null
      ? null
      : selectedOptionId === correctOptionId
        ? es
          ? 'Correcto.'
          : 'Correct.'
        : es
          ? 'Incorrecto.'
          : 'Incorrect.';
  const verdict = showFeedback ? (verdictText ?? fallbackVerdict) : null;

  return (
    <article className="arcade-question">
      <div className="arcade-question-head">
        <span>
          {es ? 'Pregunta' : 'Question'} {String(questionNumber).padStart(2, '0')} /{' '}
          {String(totalQuestions).padStart(2, '0')}
        </span>
        <span>{es ? 'Elige una respuesta' : 'Choose an answer'}</span>
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
              onClick={() => {
                if (!disabled) onSelectOption(option.id);
              }}
              disabled={(disabled && !selected) || hiddenOptionIds.includes(option.id)}
              aria-disabled={(disabled && selected) || undefined}
              aria-pressed={selected}
              // Entrada escalonada por pregunta (la tarjeta re-monta con cada
              // una); al revelar el veredicto el retardo se anula para que el
              // pulso/shake salten al instante, no tras el stagger.
              style={{ animationDelay: showFeedback ? '0ms' : `${index * 50}ms` }}
              className={cn(
                'arcade-option qv-l1-option-in',
                selected && 'arcade-option-selected',
                correct && 'arcade-option-correct qv-l1-correct-pulse',
                incorrect && 'arcade-option-incorrect qv-l1-shake',
                hiddenOptionIds.includes(option.id) && 'arcade-option-hidden'
              )}
            >
              <span className="arcade-option-letter">{String.fromCharCode(65 + index)}</span>
              <span>{option.text}</span>
              {correct && (
                <span className="arcade-option-state">{es ? 'Correcta' : 'Correct'}</span>
              )}
              {incorrect && (
                <span className="arcade-option-state">{es ? 'Incorrecta' : 'Incorrect'}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="qv-l10-question-feedback" role="status" aria-live="polite" aria-atomic="true">
        {isChecking && (
          <p className="arcade-answer-feedback qv-l10-pending">
            {es ? 'Comprobando respuesta\u2026' : 'Checking answer\u2026'}
          </p>
        )}
        {verdict && (
          <>
            <span
              className={cn(
                'arcade-answer-feedback',
                verdictCorrect !== null &&
                  (verdictCorrect ? 'qv-l1-verdict-correct' : 'qv-l1-verdict-incorrect')
              )}
            >
              {verdict}
            </span>
            {shownExplanation &&
              (showExplanation ? (
                <div className="arcade-explanation">
                  <strong>{es ? 'Explicación' : 'Explanation'}</strong>
                  <p>{shownExplanation}</p>
                </div>
              ) : (
                <span className="sr-only"> {shownExplanation}</span>
              ))}
          </>
        )}
      </div>
    </article>
  );
}
