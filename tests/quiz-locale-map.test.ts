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

it('routes the 2026t editorial pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-boxing-trivia', 'es-trivia-boxeo'],
    ['en-mma-ufc-trivia', 'es-trivia-mma-ufc'],
    ['en-martial-arts-trivia', 'es-trivia-artes-marciales'],
    ['en-track-and-field-trivia', 'es-trivia-atletismo'],
    ['en-cycling-trivia', 'es-trivia-ciclismo'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
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

it('routes the sports editorial pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-lionel-messi-trivia', 'es-trivia-lionel-messi'],
    ['en-cristiano-ronaldo-trivia', 'es-trivia-cristiano-ronaldo'],
    ['en-diego-maradona-trivia', 'es-trivia-diego-maradona'],
    ['en-sports-records-trivia', 'es-trivia-records-del-deporte'],
    ['en-women-who-changed-sports-trivia', 'es-trivia-mujeres-que-cambiaron-el-deporte'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});

it('routes the editorial 2026ai pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-queen-trivia', 'es-trivia-queen'],
    ['en-michael-jackson-trivia', 'es-trivia-michael-jackson'],
    ['en-nirvana-trivia', 'es-trivia-nirvana'],
    ['en-metallica-trivia', 'es-trivia-metallica'],
    ['en-abba-trivia', 'es-trivia-abba'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});

it('routes the editorial 2026d pairs both ways', () => {
  const pairs: [string, string][] = [
    ['en-ancient-rome-trivia', 'es-trivia-antigua-roma'],
    ['en-ancient-egypt-trivia', 'es-trivia-antiguo-egipto'],
    ['en-world-war-2-trivia', 'es-trivia-segunda-guerra-mundial'],
    ['en-nba-trivia', 'es-trivia-nba'],
    ['en-oscars-trivia', 'es-trivia-premios-oscar'],
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

it('routes the editorial 2026at pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-black-holes-trivia', 'es-trivia-agujeros-negros'],
    ['en-dna-and-genetics-trivia', 'es-trivia-adn-y-genetica'],
    ['en-volcanoes-and-earthquakes-trivia', 'es-trivia-volcanes-y-terremotos'],
    ['en-periodic-table-trivia', 'es-trivia-tabla-periodica'],
    ['en-deep-sea-trivia', 'es-trivia-fondo-del-mar'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});

it('routes the editorial 2026az pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-everyday-inventions-trivia', 'es-trivia-inventos-cotidianos'],
    ['en-world-currencies-trivia', 'es-trivia-monedas-del-mundo'],
    ['en-world-languages-trivia', 'es-trivia-idiomas-del-mundo'],
    ['en-international-organizations-trivia', 'es-trivia-organismos-internacionales'],
    ['en-world-awards-trivia', 'es-trivia-premios-del-mundo'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});

it('routes the editorial 2026cq pairs both ways', () => {
  const pairs: Array<[string, string]> = [
    ['en-f1-champions-trivia', 'es-trivia-campeones-de-f1'],
    ['en-f1-circuits-trivia', 'es-trivia-circuitos-de-f1'],
    ['en-f1-teams-trivia', 'es-trivia-escuderias-de-f1'],
    ['en-f1-2026-rules-trivia', 'es-trivia-reglamento-f1-2026'],
    ['en-f1-legends-trivia', 'es-trivia-leyendas-de-la-f1'],
  ];
  for (const [en, es] of pairs) {
    expect(getEquivalentQuizSlug(en, 'es')).toBe(es);
    expect(getEquivalentQuizSlug(es, 'en')).toBe(en);
  }
});
