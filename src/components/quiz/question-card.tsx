'use client';

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
  disabled?: boolean;
  locale: Locale;
  hiddenOptionIds?: string[];
}

export function QuestionCard({ question, questionNumber, totalQuestions, selectedOptionId, onSelectOption, showExplanation = false, showFeedback = false, disabled = false, locale, hiddenOptionIds = [] }: QuestionCardProps) {
  const es = locale === 'es';
  return (
    <article className="arcade-question">
      <div className="arcade-question-head">
        <span>{es ? 'PREGUNTA' : 'QUESTION'} {String(questionNumber).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}</span>
        <span>{es ? 'ELIGE UNA RESPUESTA' : 'CHOOSE AN ANSWER'}</span>
      </div>
      <h2>{question.question}</h2>
      {question.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image_url} alt={es ? 'Ilustración de la pregunta' : 'Question illustration'} className="arcade-question-image" />
      )}
      <div className="arcade-options">
        {question.options.map((option, index) => {
          const selected = selectedOptionId === option.id;
          const correct = showFeedback && option.is_correct;
          const incorrect = showFeedback && selected && !option.is_correct && question.options.some((item) => item.is_correct);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectOption(option.id)}
              disabled={disabled || hiddenOptionIds.includes(option.id)}
              aria-pressed={selected}
              className={cn('arcade-option', selected && 'arcade-option-selected', correct && 'arcade-option-correct', incorrect && 'arcade-option-incorrect', hiddenOptionIds.includes(option.id) && 'arcade-option-hidden')}
            >
              <span className="arcade-option-letter">{String.fromCharCode(65 + index)}</span>
              <span>{option.text}</span>
              {correct && <span className="arcade-option-state">{es ? 'CORRECTA' : 'CORRECT'}</span>}
              {incorrect && <span className="arcade-option-state">{es ? 'INCORRECTA' : 'INCORRECT'}</span>}
            </button>
          );
        })}
      </div>
      {showExplanation && showFeedback && question.explanation && (
        <div className="arcade-explanation"><strong>{es ? 'EXPLICACIÓN' : 'EXPLANATION'}</strong><p>{question.explanation}</p></div>
      )}
    </article>
  );
}
