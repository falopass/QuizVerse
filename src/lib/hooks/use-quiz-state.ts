'use client';

import { useReducer, useCallback } from 'react';
import type { Quiz, QuizState, QuizAction, Answer } from '@/types/quiz';

const initialState: QuizState = {
  status: 'idle',
  current_question_index: 0,
  answers: [],
  score: 0,
  selected_option_id: null,
  is_correct: null,
  time_remaining: 0,
};

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START_QUIZ':
      return {
        ...initialState,
        status: 'playing',
      };

    case 'SELECT_OPTION':
      return {
        ...state,
        selected_option_id: action.optionId,
      };

    case 'SUBMIT_ANSWER': {
      const newAnswer: Answer = {
        question_id: '',
        selected_option_id: action.is_correct ? state.selected_option_id! : '',
        is_correct: action.is_correct,
        time_ms: action.time_ms,
      };

      return {
        ...state,
        answers: [...state.answers, newAnswer],
        score: action.is_correct ? state.score + 1 : state.score,
        is_correct: action.is_correct,
        selected_option_id: null,
      };
    }

    case 'NEXT_QUESTION':
      return {
        ...state,
        current_question_index: state.current_question_index + 1,
      };

    case 'COMPLETE_QUIZ':
      return {
        ...state,
        status: 'completed',
        score: action.score,
      };

    case 'TICK_TIME':
      return {
        ...state,
        time_remaining: action.remaining,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useQuizState(quiz: Quiz) {
  const [state, dispatch] = useReducer(quizReducer, initialState);

  const startQuiz = useCallback(() => {
    dispatch({ type: 'START_QUIZ' });
  }, []);

  const selectOption = useCallback((optionId: string) => {
    dispatch({ type: 'SELECT_OPTION', optionId });
  }, []);

  const submitAnswer = useCallback((isCorrect: boolean, timeMs: number) => {
    dispatch({ type: 'SUBMIT_ANSWER', is_correct: isCorrect, time_ms: timeMs });
  }, []);

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT_QUESTION' });
  }, []);

  const completeQuiz = useCallback((score: number, maxScore: number) => {
    dispatch({ type: 'COMPLETE_QUIZ', score, max_score: maxScore });
  }, []);

  const tickTime = useCallback((remaining: number) => {
    dispatch({ type: 'TICK_TIME', remaining });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const currentQuestion = quiz.questions[state.current_question_index];
  const totalQuestions = quiz.questions.length;
  const progress = ((state.current_question_index + 1) / totalQuestions) * 100;

  return {
    ...state,
    currentQuestion,
    totalQuestions,
    progress,
    startQuiz,
    selectOption,
    submitAnswer,
    nextQuestion,
    completeQuiz,
    tickTime,
    reset,
  };
}

export default useQuizState;
