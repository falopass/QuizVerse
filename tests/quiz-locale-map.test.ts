import { expect, it } from 'vitest';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

it('routes published seed pairs both ways and leaves unknown quizzes without an equivalent', () => {
  expect(getEquivalentQuizSlug('en-the-white-lotus-fan-trivia-challenge', 'es')).toBe(
    'es-trivia-fan-de-the-white-lotus'
  );
  expect(getEquivalentQuizSlug('es-trivia-fan-de-re-zero', 'en')).toBe(
    'en-re-zero-fan-trivia-challenge'
  );
  expect(getEquivalentQuizSlug('en-unknown-quiz', 'es')).toBeNull();
});
