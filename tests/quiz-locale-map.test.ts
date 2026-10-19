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

it('routes the evergreen personality pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-what-kind-of-traveler-are-you', 'es-que-tipo-de-viajero-eres'],
    ['en-what-kind-of-friend-are-you', 'es-que-tipo-de-amigo-eres'],
    ['en-what-is-your-work-style', 'es-cual-es-tu-estilo-de-trabajo'],
    ['en-what-is-your-learning-style', 'es-cual-es-tu-estilo-de-aprendizaje'],
    ['en-what-is-your-ideal-weekend', 'es-cual-es-tu-fin-de-semana-ideal'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});
