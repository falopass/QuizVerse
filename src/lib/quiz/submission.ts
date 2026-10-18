/**
 * Quiz submission: validation and authoritative scoring.
 *
 * One place decides what a finished game is worth. The client sends *choices*;
 * this module validates them, grades them against the stored quiz and returns
 * the numbers that get persisted. Nothing here trusts the caller.
 */

import { z } from 'zod';
import { calculatePersonalityResult } from './engine';
import { findQuestion } from './answer-key';
import type { Answer, Quiz } from '@/types/quiz';

/** Hard caps that keep a malicious payload from costing a full table scan. */
const MAX_ANSWERS = 50;
const MAX_TIME_MS = 30 * 60 * 1000;
const MAX_TOTAL_SECONDS = 2 * 60 * 60;

export const QuizAnswerSchema = z.object({
  question_id: z.string().min(1).max(64),
  /** Empty string means the player skipped the question; it counts as unanswered. */
  selected_option_id: z.string().max(64),
  time_ms: z.number().int().min(0).max(MAX_TIME_MS).optional().default(0),
});

export const QuizSubmissionSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.array(QuizAnswerSchema).min(1).max(MAX_ANSWERS),
  timeTakenSeconds: z.number().int().min(0).max(MAX_TOTAL_SECONDS).optional().default(0),
});

export type QuizSubmissionInput = z.infer<typeof QuizSubmissionSchema>;

export interface ScoredSubmission {
  /** Correct answers for trivia; answered questions for personality. */
  score: number;
  maxScore: number;
  percentage: number;
  resultId: string | null;
  resultTitle: string | null;
  /** Answers re-graded on the server; safe to persist and to show as a review. */
  graded: Answer[];
  perfect: boolean;
}

/**
 * Grades a submission against the quiz stored in the database.
 *
 * - Answers for questions that do not belong to the quiz are dropped.
 * - Duplicate answers for one question keep the first one only.
 * - Trivia scores on correctness; personality quizzes score on completion and
 *   resolve the dominant personality tag into a result.
 */
export function scoreSubmission(
  quiz: Pick<Quiz, 'questions' | 'results' | 'quiz_type'>,
  answers: Array<z.infer<typeof QuizAnswerSchema>>
): ScoredSubmission {
  const seen = new Set<string>();
  const graded: Answer[] = [];
  const personalityTags: string[] = [];

  for (const answer of answers) {
    if (seen.has(answer.question_id)) continue;
    const question = findQuestion(quiz, answer.question_id);
    if (!question) continue;

    const option = question.options.find((item) => item.id === answer.selected_option_id);
    const correctOption = question.options.find((item) => item.is_correct === true);
    const isCorrect =
      quiz.quiz_type === 'trivia'
        ? Boolean(option && correctOption && option.id === correctOption.id)
        : Boolean(option);

    seen.add(answer.question_id);
    graded.push({
      question_id: question.id,
      selected_option_id: answer.selected_option_id,
      is_correct: isCorrect,
      time_ms: answer.time_ms,
    });

    if (quiz.quiz_type === 'personality' && option?.personality_tags) {
      personalityTags.push(...option.personality_tags);
    }
  }

  const maxScore = quiz.questions.length;
  let score = 0;
  let resultId: string | null = null;
  let resultTitle: string | null = null;

  if (quiz.quiz_type === 'trivia') {
    score = graded.filter((answer) => answer.is_correct).length;
  } else {
    // Personality quizzes have no wrong answers: completing them is the pass.
    score = graded.length;
    const result = calculatePersonalityResult(personalityTags, quiz.results ?? []);
    resultId = result?.id ?? null;
    resultTitle = result?.title ?? null;
  }

  return {
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    resultId,
    resultTitle,
    graded,
    perfect: maxScore > 0 && score === maxScore,
  };
}

/**
 * Points shown to the player.
 *
 * Mirrors the database trigger `award_quiz_points`, which is the real source of
 * truth: 10 for finishing, +25 for a perfect score. Keep both in sync.
 */
export function pointsFor(perfect: boolean): number {
  return perfect ? 35 : 10;
}
