/**
 * Server-side answer key.
 *
 * A quiz's `questions[].options[].is_correct` is the answer key. It must never
 * reach the browser: if it does, the score, the points and the leaderboard all
 * become guessable. Everything in this module runs on the server only.
 *
 * The client sends what the player *chose*; this module decides what that
 * choice was worth.
 */

import 'server-only';

import type { Answer, Question, Quiz, QuizReviewItem } from '@/types/quiz';

export type { QuizReviewItem } from '@/types/quiz';

/** What the player picked. Deliberately has no `is_correct` field. */
export interface QuizAnswerInput {
  question_id: string;
  selected_option_id: string;
  time_ms?: number;
}

export interface AnswerVerdict {
  question: Question;
  selectedOptionId: string;
  isCorrect: boolean;
  /** Id of the right option, so the UI can reveal it after the answer. */
  correctOptionId: string | null;
  explanation: string | null;
}

/** Finds a question by id, tolerating quizzes stored with duplicate ids. */
export function findQuestion(quiz: Pick<Quiz, 'questions'>, questionId: string): Question | null {
  return quiz.questions.find((question) => question.id === questionId) ?? null;
}

function findCorrectOptionId(question: Question): string | null {
  return question.options.find((option) => option.is_correct === true)?.id ?? null;
}

/**
 * Grades a single answer against the stored quiz.
 *
 * Returns `null` when the question does not exist, which callers treat as a
 * rejected payload rather than as a wrong answer.
 */
export function evaluateAnswer(
  quiz: Pick<Quiz, 'questions'>,
  questionId: string,
  selectedOptionId: string
): AnswerVerdict | null {
  const question = findQuestion(quiz, questionId);
  if (!question) return null;

  const selected = question.options.find((option) => option.id === selectedOptionId);
  const correctOptionId = findCorrectOptionId(question);

  return {
    question,
    selectedOptionId,
    isCorrect: Boolean(selected && correctOptionId && selected.id === correctOptionId),
    correctOptionId,
    explanation: question.explanation ?? null,
  };
}

/** FNV-1a — tiny, stable hash used to pick options without a random source. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Picks the wrong options a 50/50 power-up may hide.
 *
 * Deterministic on purpose: refreshing the page must not reroll a better hint,
 * and the same question always yields the same pair.
 */
export function eliminateWrongOptions(
  quiz: Pick<Quiz, 'id' | 'questions'>,
  questionId: string,
  count = 2
): string[] {
  const question = findQuestion(quiz, questionId);
  if (!question || question.options.length <= count) return [];

  return question.options
    .filter((option) => option.is_correct !== true)
    .map((option) => ({ id: option.id, rank: hashString(`${quiz.id}:${questionId}:${option.id}`) }))
    .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id))
    .slice(0, count)
    .map((entry) => entry.id);
}

/**
 * Projection of a quiz that is safe to serialize to the browser.
 *
 * Drops the answer key; keeps everything the play and result screens render.
 */
export function toClientQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      ...question,
      options: question.options.map(({ is_correct: _isCorrect, ...option }) => option),
    })),
  };
}

/**
 * Builds the "review your answers" payload on the server, so the result screen
 * can show the right answer without ever receiving the answer key.
 */
export function buildReview(
  quiz: Pick<Quiz, 'questions' | 'quiz_type'>,
  answers: Array<Pick<Answer, 'question_id' | 'selected_option_id' | 'is_correct'>>
): QuizReviewItem[] {
  return answers.flatMap((answer) => {
    const question = findQuestion(quiz, answer.question_id);
    if (!question) return [];

    const selected = question.options.find((option) => option.id === answer.selected_option_id);
    const correct = question.options.find((option) => option.is_correct === true);

    return [
      {
        questionId: question.id,
        question: question.question,
        selectedOptionText: selected?.text ?? null,
        correctOptionText: correct?.text ?? null,
        isCorrect:
          quiz.quiz_type === 'trivia'
            ? Boolean(selected && correct && selected.id === correct.id)
            : Boolean(answer.is_correct),
      },
    ];
  });
}
