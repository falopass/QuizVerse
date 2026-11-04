/**
 * Tests de `src/lib/content/franchise.ts`: extracción de franquicia por
 * plantilla (es/en), slug ASCII, umbral de 3 quizzes por hub y la pareja de
 * idioma por votación del mapa de quizzes bilingües.
 *
 * Los títulos de las fixtures son los que publica el catálogo real
 * (scripts/seed/editorial-seed-*.json y la API pública).
 */

import { describe, expect, it } from 'vitest';
import {
  FANDOM_MIN_QUIZZES,
  buildFandomHubs,
  dominantCategory,
  extractFranchise,
  franchiseSlug,
  pairedFandomSlug,
} from '@/lib/content/franchise';

describe('extractFranchise — español', () => {
  const cases: Array<[string, string]> = [
    ['Trivia fan de Frieren', 'Frieren'],
    ['Trivia fan de Los Simpson: Springfield', 'Los Simpson'],
    ['Trivia fan de Re:ZERO', 'Re:ZERO'],
    ['Trivia fan del anime primavera 2026', 'anime primavera 2026'],
    ['¿Qué energía de Stranger Things combina mejor contigo?', 'Stranger Things'],
    [
      '¿Qué energía de The Super Mario Galaxy Movie combina mejor contigo?',
      'The Super Mario Galaxy Movie',
    ],
    ['¿Qué rol jugarías dentro de The Boys?', 'The Boys'],
    ['¿Qué rol jugarías en Stranger Things?', 'Stranger Things'],
    ['¿Qué rol jugarías dentro del K-pop?', 'K-pop'],
    ['¿Qué tan profundo llega tu conocimiento de Star Wars?', 'Star Wars'],
    [
      '¿Qué tan profundo llega tu conocimiento de That Time I Got Reincarnated as a Slime?',
      'That Time I Got Reincarnated as a Slime',
    ],
  ];

  it.each(cases)('%s → %s', (title, expected) => {
    expect(extractFranchise(title, 'es')).toBe(expected);
  });

  it.each([
    'Trivia de Disney: ¿cuánto sabes de los clásicos?', // plantilla genérica de tema
    'Trivia de los villanos de Disney: los malos que amamos', // sub-tema fragmentaría Disney
    'Trivia de tenis: ¿cuánto sabes de los Grand Slams?',
    '¿Qué energía de app de citas estás trayendo?', // sufijo distinto, tema genérico
    '¿Cuál es tu lenguaje del amor? Los cinco clásicos',
    '¿Qué postre eres? Un quiz de personalidad',
    'Test de compatibilidad de pareja: la versión honesta',
    '¿Qué rol tendrías en un grupo de K-pop?', // plantilla distinta, sin franquicia
    '',
    '   ',
  ])('devuelve null para «%s»', (title) => {
    expect(extractFranchise(title, 'es')).toBeNull();
  });
});

describe('extractFranchise — inglés', () => {
  const cases: Array<[string, string]> = [
    ['Frieren Fan Trivia Challenge', 'Frieren'],
    ['The Simpsons Fan Trivia Challenge', 'The Simpsons'],
    ['The Super Mario Galaxy Movie Fan Trivia', 'The Super Mario Galaxy Movie'],
    ['Breaking Bad Trivia Challenge', 'Breaking Bad'],
    ['Which Stranger Things energy matches you best?', 'Stranger Things'],
    ['Which Witch Hat Atelier Energy Matches You Best?', 'Witch Hat Atelier'],
    ['What role would you play inside The Boys?', 'The Boys'],
    ['What Role Would You Play Inside Re:ZERO?', 'Re:ZERO'],
    ['How deep does your Star Wars knowledge go?', 'Star Wars'],
    ["How deep does your Baldur's Gate 3 knowledge go?", "Baldur's Gate 3"],
  ];

  it.each(cases)('%s → %s', (title, expected) => {
    expect(extractFranchise(title, 'en')).toBe(expected);
  });

  it.each([
    'Animal Trivia: Species, Habitats and Natural Records', // tema, no franquicia
    'Disney Villains Trivia: The Bad Guys We Love to Hate', // sub-tema fragmentaría Disney
    'Spring 2026 Anime Trivia: What to Watch', // temporada, no franquicia
    'What Is Your Love Language? The Classic Five',
    'Which Bird Are You?',
    'What role would you play in a band?', // sin «inside», sin franquicia
    'How deep is your love? A music quiz',
  ])('devuelve null para «%s»', (title) => {
    expect(extractFranchise(title, 'en')).toBeNull();
  });
});

describe('extractFranchise — el locale manda', () => {
  it('una plantilla española no se reconoce en inglés', () => {
    expect(extractFranchise('Trivia fan de Frieren', 'en')).toBeNull();
  });

  it('una plantilla inglesa no se reconoce en español', () => {
    expect(extractFranchise('Frieren Fan Trivia Challenge', 'es')).toBeNull();
  });
});

describe('franchiseSlug', () => {
  it.each([
    ['Frieren', 'frieren'],
    ['The Boys', 'the-boys'],
    ['Re:ZERO', 're-zero'],
    ['Pokémon', 'pokemon'],
    ["Baldur's Gate 3", 'baldur-s-gate-3'],
    ['El Juego del Calamar', 'el-juego-del-calamar'],
    ['That Time I Got Reincarnated as a Slime', 'that-time-i-got-reincarnated-as-a-slime'],
  ])('%s → %s', (name, expected) => {
    expect(franchiseSlug(name)).toBe(expected);
  });

  it('colapsa variantes del mismo nombre en un solo slug', () => {
    expect(franchiseSlug('Pokémon')).toBe(franchiseSlug('Pokemon'));
    expect(franchiseSlug('Re:ZERO')).toBe(franchiseSlug('Re Zero'));
  });
});

function quiz(slug: string, title: string, category?: string) {
  return {
    slug,
    title,
    category: category ? { slug: category, name: category } : null,
  };
}

const ES_FRIEREN = [
  quiz('es-trivia-fan-de-frieren', 'Trivia fan de Frieren', 'anime-manga'),
  quiz(
    'es-que-tan-profundo-llega-tu-conocimiento-de-frieren',
    '¿Qué tan profundo llega tu conocimiento de Frieren?',
    'anime-manga'
  ),
  quiz(
    'es-que-energia-de-frieren-combina-mejor-contigo',
    '¿Qué energía de Frieren combina mejor contigo?',
    'anime-manga'
  ),
  quiz(
    'es-que-rol-jugarias-dentro-de-frieren',
    '¿Qué rol jugarías dentro de Frieren?',
    'anime-manga'
  ),
];

describe('buildFandomHubs', () => {
  it('agrupa las cuatro plantillas bajo un mismo slug', () => {
    const hubs = buildFandomHubs(ES_FRIEREN, 'es');
    expect(hubs.size).toBe(1);
    const hub = hubs.get('frieren');
    expect(hub?.name).toBe('Frieren');
    expect(hub?.quizzes).toHaveLength(4);
  });

  it(`exige ${FANDOM_MIN_QUIZZES} quizzes: grupos menores no existen`, () => {
    const hubs = buildFandomHubs(ES_FRIEREN.slice(0, 2), 'es');
    expect(hubs.size).toBe(0);
  });

  it('los quizzes sin plantilla de franquicia no entran en ningún grupo', () => {
    const hubs = buildFandomHubs(
      [...ES_FRIEREN, quiz('es-trivia-aves', 'Trivia de animales: ¿cuánto sabes de las aves?')],
      'es'
    );
    expect(hubs.size).toBe(1);
    expect(hubs.get('frieren')?.quizzes).toHaveLength(4);
  });

  it('funde nombres que comparten slug y conserva el del primero visto', () => {
    const hubs = buildFandomHubs(
      [
        quiz('a', 'Trivia fan de Pokémon'),
        quiz('b', '¿Qué energía de Pokemon combina mejor contigo?'),
        quiz('c', '¿Qué rol jugarías en Pokémon?'),
      ],
      'es'
    );
    expect(hubs.size).toBe(1);
    const hub = hubs.get('pokemon');
    expect(hub?.name).toBe('Pokémon');
    expect(hub?.quizzes.map((item) => item.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('pairedFandomSlug', () => {
  const EN_HUB = buildFandomHubs(
    [
      quiz('en-frieren-fan-trivia-challenge', 'Frieren Fan Trivia Challenge'),
      quiz('en-wednesday-fan-trivia-challenge', 'Wednesday Fan Trivia Challenge'),
      quiz('en-wednesday-role', 'What role would you play inside Wednesday?'),
      quiz('en-wednesday-energy', 'Which Wednesday energy matches you best?'),
      quiz('en-wednesday-deep', 'How deep does your Wednesday knowledge go?'),
      quiz('en-dune-fan', 'Dune Fan Trivia Challenge'),
      quiz('en-dune-role', 'What role would you play inside Dune?'),
      quiz('en-dune-energy', 'Which Dune energy matches you best?'),
    ],
    'en'
  );
  const ES_HUBS = buildFandomHubs(
    [
      ...ES_FRIEREN,
      quiz('es-trivia-fan-de-merlina', 'Trivia fan de Merlina'),
      quiz('es-merlina-rol', '¿Qué rol jugarías dentro de Merlina?'),
      quiz('es-merlina-energia', '¿Qué energía de Merlina combina mejor contigo?'),
    ],
    'es'
  );
  const hubs = { en: EN_HUB, es: ES_HUBS };

  // en-wednesday-* ↔ es-merlina-*: los slugs de franquicia no se parecen en
  // nada; la pareja solo se deduce del mapa de quizzes.
  const PAIRS: Record<string, string> = {
    'en-wednesday-fan-trivia-challenge': 'es-trivia-fan-de-merlina',
    'en-wednesday-role': 'es-merlina-rol',
    'en-wednesday-energy': 'es-merlina-energia',
    'en-wednesday-deep': 'es-trivia-fan-de-merlina',
    'es-trivia-fan-de-merlina': 'en-wednesday-fan-trivia-challenge',
    'es-merlina-rol': 'en-wednesday-role',
    'es-merlina-energia': 'en-wednesday-energy',
  };
  const counterpartOf = (slug: string) => PAIRS[slug] ?? null;

  it('empareja hubs aunque los slugs sean distintos (Merlina ↔ Wednesday)', () => {
    expect(pairedFandomSlug(hubs, 'es', 'merlina', counterpartOf)).toBe('wednesday');
    expect(pairedFandomSlug(hubs, 'en', 'wednesday', counterpartOf)).toBe('merlina');
  });

  it('un solo voto válido basta si el mapa solo conoce un par', () => {
    // El mapa real es bidireccional: un par conocido en las dos direcciones
    // confirma la pareja aunque el resto de miembros no tenga traducción.
    const lonely = (slug: string) =>
      (
        ({
          'en-wednesday-fan-trivia-challenge': 'es-trivia-fan-de-merlina',
          'es-trivia-fan-de-merlina': 'en-wednesday-fan-trivia-challenge',
        }) as Record<string, string>
      )[slug] ?? null;
    expect(pairedFandomSlug(hubs, 'en', 'wednesday', lonely)).toBe('merlina');
  });

  it('sin reciprocidad no hay pareja: el elegido debe elegir de vuelta', () => {
    // es-merlina vota a wednesday, pero en-wednesday vota a frieren:
    // anunciar la pareja en un solo sentido sería un hreflang asimétrico.
    const oneWay = (slug: string) =>
      (
        ({
          'es-trivia-fan-de-merlina': 'en-wednesday-fan-trivia-challenge',
          'es-merlina-rol': 'en-wednesday-role',
          'es-merlina-energia': 'en-wednesday-energy',
          'en-wednesday-fan-trivia-challenge': 'es-trivia-fan-de-frieren',
          'en-wednesday-role': 'es-trivia-fan-de-frieren',
          'en-wednesday-energy': 'es-trivia-fan-de-frieren',
          'en-wednesday-deep': 'es-trivia-fan-de-frieren',
        }) as Record<string, string>
      )[slug] ?? null;
    expect(pairedFandomSlug(hubs, 'es', 'merlina', oneWay)).toBeNull();
    expect(pairedFandomSlug(hubs, 'en', 'wednesday', oneWay)).toBeNull();
  });

  it('un slug que no es hub devuelve null aunque el mapa conozca pares', () => {
    // en-frieren tiene un solo quiz: el grupo no llega a 3 y no existe.
    expect(pairedFandomSlug(hubs, 'en', 'frieren', counterpartOf)).toBeNull();
  });

  it('sin mayoría estricta no hay pareja: empate se resuelve a null', () => {
    const tie = (slug: string) =>
      (
        ({
          'es-trivia-fan-de-merlina': 'en-wednesday-fan-trivia-challenge',
          'es-merlina-rol': 'en-wednesday-role',
          'es-merlina-energia': 'en-dune-fan', // voto espurio a otro hub
          // La vuelta confirma: los miembros de wednesday votan a merlina.
          'en-wednesday-fan-trivia-challenge': 'es-trivia-fan-de-merlina',
          'en-wednesday-role': 'es-merlina-rol',
          'en-wednesday-energy': 'es-merlina-energia',
          'en-wednesday-deep': 'es-trivia-fan-de-merlina',
        }) as Record<string, string>
      )[slug] ?? null;
    // 3 votos: 2 a wednesday, 1 a dune → mayoría a wednesday
    expect(pairedFandomSlug(hubs, 'es', 'merlina', tie)).toBe('wednesday');
    const split = (slug: string) =>
      (
        ({
          'es-trivia-fan-de-merlina': 'en-wednesday-fan-trivia-challenge',
          'es-merlina-rol': 'en-dune-role',
        }) as Record<string, string>
      )[slug] ?? null;
    // 2 votos a dos hubs distintos: 1-1 no es mayoría
    expect(pairedFandomSlug(hubs, 'es', 'merlina', split)).toBeNull();
  });

  it('un hub que no existe devuelve null', () => {
    expect(pairedFandomSlug(hubs, 'es', 'dragon-ball', () => null)).toBeNull();
  });
});

describe('dominantCategory', () => {
  it('devuelve la categoría con más miembros', () => {
    const best = dominantCategory([
      quiz('a', 'x', 'anime-manga'),
      quiz('b', 'x', 'anime-manga'),
      quiz('c', 'x', 'gaming'),
    ]);
    expect(best).toEqual({ slug: 'anime-manga', name: 'anime-manga' });
  });

  it('null cuando nadie tiene categoría', () => {
    expect(dominantCategory([quiz('a', 'x')])).toBeNull();
  });
});
