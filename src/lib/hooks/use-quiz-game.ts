'use client';

import { useCallback, useMemo, useReducer } from 'react';
import { createInitialQuizState, quizReducer } from '@/lib/quiz/engine';
import { calculateQuestionScore } from '@/lib/quiz/engine';
import { calculatePersonalityScore } from '@/lib/quiz/scoring';
import { trackEvent } from '@/lib/hooks/use-telemetry';
import type { Question, Quiz } from '@/types/quiz';

export function useQuizGame(quiz: Quiz) {
  const initialState = useMemo(() => createInitialQuizState(quiz), [quiz]);
  const [state, dispatch] = useReducer(quizReducer, initialState);

  const start = useCallback(() => {
    dispatch({ type: 'START_GAME' });
    trackEvent('quiz_start', { quiz_id: quiz.id, quiz_slug: quiz.slug });
  }, [quiz.id, quiz.slug]);

  const answer = useCallback(
    (questionId: string, optionId: string) => {
      const question = quiz.questions.find((q) => q.id === questionId);
      if (!question) return;

      const result = calculateQuestionScore(
        question,
        optionId,
        quiz.quiz_type as 'trivia' | 'personality'
      );

      dispatch({
        type: 'SUBMIT_ANSWER',
        questionId,
        optionId,
        score: result.score,
        isCorrect: result.is_correct,
        personalityTags: quiz.quiz_type === 'personality' ? result.personality_tags : undefined,
      });
    },
    [quiz]
  );

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT_QUESTION' });
  }, []);

  const finish = useCallback(() => {
    dispatch({ type: 'FINISH_GAME' });
    const personalityResult =
      quiz.quiz_type === 'personality' && quiz.results
        ? calculatePersonalityScore(quiz.questions, state.answers, quiz.results)
        : null;

    trackEvent('quiz_complete', {
      quiz_id: quiz.id,
      score: state.score,
      total: quiz.questions.length,
      result: personalityResult?.dominantTag ?? null,
    });
  }, [quiz, state.score, state.answers]);

  const currentQuestion: Question | null = useMemo(
    () => quiz.questions[state.current_question_index] ?? null,
    [quiz.questions, state.current_question_index]
  );

  const progress = useMemo(
    () =>
      quiz.questions.length > 0 ? (state.current_question_index / quiz.questions.length) * 100 : 0,
    [state.current_question_index, quiz.questions.length]
  );

  return { state, currentQuestion, progress, start, answer, nextQuestion, finish };
}
