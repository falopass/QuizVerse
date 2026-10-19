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

it('routes the editorial 2026g pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-dinosaurs-trivia', 'es-trivia-dinosaurios'],
    ['en-pre-columbian-civilizations-trivia', 'es-trivia-civilizaciones-precolombinas'],
    ['en-norse-mythology-trivia', 'es-trivia-mitologia-nordica'],
    ['en-great-explorers-trivia', 'es-trivia-grandes-exploradores'],
    ['en-80s-movies-trivia', 'es-trivia-peliculas-de-los-80'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});

it('routes the 2026b editorial pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-science-basics-trivia', 'es-trivia-ciencia-basica'],
    ['en-computing-history-trivia', 'es-trivia-historia-computacion'],
    ['en-food-origins-trivia', 'es-trivia-origenes-gastronomia'],
    ['en-wildlife-records-trivia', 'es-trivia-records-animales'],
    ['en-getting-along-trivia', 'es-trivia-arte-de-convivir'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});

it('routes the editorial 2026c pairs both ways', () => {
  expect(getEquivalentQuizSlug('en-world-flags-trivia', 'es')).toBe('es-trivia-banderas-del-mundo');
  expect(getEquivalentQuizSlug('es-trivia-frases-de-peliculas', 'en')).toBe(
    'en-movie-quotes-trivia'
  );
});
