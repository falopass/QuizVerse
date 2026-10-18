import { afterEach, expect, it, vi } from 'vitest';
import { useQuizStore } from '@/stores/quiz-store';
import type { Quiz } from '@/types/quiz';

const quiz = {
  id: 'arcade-test',
  quiz_type: 'trivia',
  questions: [
    {
      id: 'q1',
      question: 'First?',
      time_limit_seconds: 30,
      options: [
        { id: 'wrong', text: 'No', is_correct: false },
        { id: 'right', text: 'Yes', is_correct: true },
      ],
    },
    {
      id: 'q2',
      question: 'Second?',
      time_limit_seconds: 20,
      options: [{ id: 'right2', text: 'Yes', is_correct: true }],
    },
  ],
} as Quiz;

afterEach(() => vi.useRealTimers());

it('only Time Attack has a clock; Survival ends after a mistake', () => {
  vi.useFakeTimers();
  for (const mode of ['normal', 'practice', 'survival'] as const) {
    useQuizStore.getState().startGame(quiz, mode);
    expect(useQuizStore.getState().timeRemaining).toBe(0);
  }
  useQuizStore.getState().startGame(quiz, 'timed');
  expect(useQuizStore.getState().timeRemaining).toBe(50);
  useQuizStore.getState().startGame(quiz, 'survival');
  useQuizStore.getState().selectOption('wrong');
  // The verdict comes from the server: the browser has no answer key.
  useQuizStore.getState().submitAnswer({ isCorrect: false });
  vi.advanceTimersByTime(1500);
  expect(useQuizStore.getState().isCompleted).toBe(true);
  expect(useQuizStore.getState().answers).toHaveLength(1);
});

it('records the answer and advances even when the reveal failed', () => {
  vi.useFakeTimers();
  useQuizStore.getState().startGame(quiz, 'normal');
  useQuizStore.getState().selectOption('right');
  useQuizStore.getState().submitAnswer();

  // Without a verdict there is no feedback to wait for...
  expect(useQuizStore.getState().showFeedback).toBe(false);
  expect(useQuizStore.getState().lastAnswerCorrect).toBeNull();
  expect(useQuizStore.getState().answers).toHaveLength(1);

  // ...but the game still moves on and the answer is kept for submission.
  vi.advanceTimersByTime(400);
  expect(useQuizStore.getState().currentQuestionIndex).toBe(1);
});
