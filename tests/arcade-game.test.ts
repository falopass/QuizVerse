import { afterEach, expect, it, vi } from 'vitest';
import { useQuizStore } from '@/stores/quiz-store';
import type { Quiz } from '@/types/quiz';

const quiz = {
  id: 'arcade-test',
  quiz_type: 'trivia',
  questions: [
    { id: 'q1', question: 'First?', time_limit_seconds: 30, options: [{ id: 'wrong', text: 'No', is_correct: false }, { id: 'right', text: 'Yes', is_correct: true }] },
    { id: 'q2', question: 'Second?', time_limit_seconds: 20, options: [{ id: 'right2', text: 'Yes', is_correct: true }] },
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
  useQuizStore.getState().submitAnswer();
  vi.advanceTimersByTime(1500);
  expect(useQuizStore.getState().isCompleted).toBe(true);
  expect(useQuizStore.getState().answers).toHaveLength(1);
});
