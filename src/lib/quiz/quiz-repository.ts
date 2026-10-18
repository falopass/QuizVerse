/**
 * Read access to a quiz's answer key.
 *
 * Only the server needs the correct answers, so this module is the single door
 * to them: both the reveal endpoint and the submission action load the quiz
 * through here instead of selecting `questions` ad hoc.
 */

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { parseQuestions, parseResults } from '@/lib/data/normalizers';
import type { PersonalityResult, Question } from '@/types/quiz';
import type { QuizType } from '@/types/database';

export interface AnswerKeyQuiz {
  id: string;
  slug: string;
  quiz_type: QuizType;
  questions: Question[];
  results: PersonalityResult[] | null;
}

interface AnswerKeyRow {
  id: string;
  slug: string;
  quiz_type: QuizType;
  questions: unknown;
  results: unknown;
}

function toAnswerKey(row: AnswerKeyRow): AnswerKeyQuiz {
  return {
    id: row.id,
    slug: row.slug,
    quiz_type: row.quiz_type,
    questions: parseQuestions(row.questions as Parameters<typeof parseQuestions>[0]),
    results: parseResults(row.results as Parameters<typeof parseResults>[0]),
  };
}

/**
 * Loads the answer key for a published quiz.
 *
 * Unpublished quizzes return `null`: a draft must not be playable even by id.
 */
export async function loadAnswerKeyByQuizId(quizId: string): Promise<AnswerKeyQuiz | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, slug, quiz_type, questions, results')
    .eq('id', quizId)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  return toAnswerKey(data as AnswerKeyRow);
}
