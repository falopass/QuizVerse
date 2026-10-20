import type { Locale } from '@/lib/i18n/dictionaries';
import type { Quiz } from '@/types/quiz';

/**
 * Colecciones editoriales: landings curadas por intención de búsqueda
 * («juegos de preguntas», «tests de personalidad»…). Cada una junta quizzes
 * reales del catálogo con un filtro declarativo, copy propio y slugs
 * distintos por idioma. Todo el texto público de /{locale}/collections vive
 * aquí, no en los diccionarios (mismo patrón que lib/i18n/category-guides).
 */

export interface CollectionFaq {
  question: string;
  answer: string;
}

export interface CollectionCopy {
  /** <h1> de la landing y texto del enlace en el índice. */
  title: string;
  /** Meta description de la landing y bajada de la tarjeta del índice. */
  description: string;
  intro: [string, string];
  faq: CollectionFaq[];
}

export interface CollectionFilter {
  types?: Array<Quiz['quiz_type']>;
  categorySlugs?: string[];
  maxMinutes?: number;
}

export interface Collection {
  id: string;
  slugs: Record<Locale, string>;
  filter: CollectionFilter;
  limit: number;
  copy: Record<Locale, CollectionCopy>;
}

const COLLECTION_LIMIT = 18;

/** Mínimo de tarjetas para que una landing no se vea vacía. */
export const MIN_COLLECTION_QUIZZES = 8;

export const COLLECTIONS: Collection[] = [
  {
    id: 'trivia-games',
    slugs: { en: 'trivia-games', es: 'juegos-de-preguntas' },
    filter: { types: ['trivia'] },
    limit: COLLECTION_LIMIT,
    copy: {
      en: {
        title: 'Trivia games',
        description:
          'Free trivia games to play in the browser: movies, anime, gaming, music and more. Instant score, three game modes and no signup.',
        intro: [
          'This collection gathers the trivia side of QuizVerse: rounds where every question has one right answer and you find out if you got it as soon as you pick. The topics follow the catalogue — movies and TV, anime and manga, video games, music and general culture — so there is always a round about something you actually watch or play.',
          'Every quiz has around eight questions and takes three or four minutes in the browser. You choose the pace before starting: Classic mode has no clock, Time Attack runs a countdown across the whole round and Survival ends the run at the first mistake. Each game also gives you a 50/50 and a skip to spend once.',
        ],
        faq: [
          {
            question: 'Are these trivia games free?',
            answer:
              'Yes. Every trivia round on QuizVerse is free, with no premium questions and no signup required to play.',
          },
          {
            question: 'Do I see the right answer after each question?',
            answer:
              'Yes. Trivia shows a verdict right after you answer, and the result screen reviews every question when you finish.',
          },
          {
            question: 'Can I play trivia games on my phone?',
            answer:
              'Yes. Everything runs in the browser on phone or desktop. On a keyboard you can even answer with the number keys.',
          },
        ],
      },
      es: {
        title: 'Juegos de preguntas',
        description:
          'Juegos de preguntas gratis para jugar en el navegador: cine, anime, videojuegos, música y más. Puntaje al instante y sin registro.',
        intro: [
          'Esta colección reúne el lado trivia de QuizVerse: rondas donde cada pregunta tiene una sola respuesta correcta y sabes si acertaste apenas la eliges. Los temas siguen al catálogo —cine y series, anime y manga, videojuegos, música y cultura general— así que siempre hay una ronda sobre algo que de verdad ves o juegas.',
          'Cada quiz tiene unas ocho preguntas y se juega en tres o cuatro minutos en el navegador. Tú eliges el ritmo antes de empezar: el modo Clásico no tiene reloj, Contrarreloj corre una cuenta regresiva para toda la ronda y Supervivencia termina la partida en el primer error. Además, cada juego te da un 50/50 y un salto para usar una vez.',
        ],
        faq: [
          {
            question: '¿Estos juegos de preguntas son gratis?',
            answer:
              'Sí. Todas las trivias de QuizVerse son gratis, sin preguntas premium y sin pedir registro para jugar.',
          },
          {
            question: '¿Veo la respuesta correcta después de cada pregunta?',
            answer:
              'Sí. La trivia muestra si acertaste apenas respondes, y la pantalla de resultado revisa cada pregunta al terminar.',
          },
          {
            question: '¿Puedo jugar desde el celular?',
            answer:
              'Sí. Todo funciona en el navegador del celular o del computador. Con teclado puedes responder con los números.',
          },
        ],
      },
    },
  },
  {
    id: 'general-knowledge',
    slugs: { en: 'general-knowledge', es: 'cultura-general' },
    filter: { categorySlugs: ['culture', 'history', 'science', 'geography'] },
    limit: COLLECTION_LIMIT,
    copy: {
      en: {
        title: 'General knowledge quizzes',
        description:
          'General knowledge quizzes on history, science, geography and culture. Free rounds in English and Spanish, with a full answer review at the end.',
        intro: [
          'General knowledge is where the catalogue stops being about fandoms and starts being about what everyone should know: history, science, geography and the cultural references that cross borders. The quizzes here ask about real events, places and discoveries instead of plot points and characters.',
          'Rounds keep the same format as the rest of the site — around eight questions, three or four minutes, three game modes — but Practice mode is the one that fits best here: when a question has an explanation, you see it after answering, so a wrong guess still teaches you something.',
        ],
        faq: [
          {
            question: 'What topics count as general knowledge here?',
            answer:
              'History, science, geography and culture: real events, places, discoveries and shared references rather than a single show or game.',
          },
          {
            question: 'Is there a mode that explains the answers?',
            answer:
              'Yes. Practice mode shows the explanation after each answer whenever the question includes one, and it has no clock.',
          },
          {
            question: 'Are the quizzes available in Spanish?',
            answer:
              'Yes. The catalogue is bilingual: the same collections exist in English at /en and in Spanish at /es.',
          },
        ],
      },
      es: {
        title: 'Preguntas de cultura general',
        description:
          'Quizzes de cultura general sobre historia, ciencia, geografía y cultura. Rondas gratis en español e inglés, con revisión de respuestas al final.',
        intro: [
          'La cultura general es donde el catálogo deja de tratar sobre fandoms y empieza a tratar sobre lo que todos deberíamos saber: historia, ciencia, geografía y las referencias culturales que cruzan fronteras. Aquí las preguntas van sobre eventos, lugares y descubrimientos reales, no sobre tramas ni personajes.',
          'Las rondas mantienen el formato del sitio —unas ocho preguntas, tres o cuatro minutos, tres modos de juego— pero el modo que mejor le queda es Práctica: cuando una pregunta tiene explicación, la ves después de responder, así que incluso fallar te enseña algo.',
        ],
        faq: [
          {
            question: '¿Qué temas entran en cultura general?',
            answer:
              'Historia, ciencia, geografía y cultura: eventos, lugares, descubrimientos y referencias compartidas, no una sola serie o juego.',
          },
          {
            question: '¿Hay un modo que explique las respuestas?',
            answer:
              'Sí. El modo Práctica muestra la explicación después de cada respuesta cuando la pregunta la incluye, y no tiene reloj.',
          },
          {
            question: '¿Los quizzes están también en inglés?',
            answer:
              'Sí. El catálogo es bilingüe: las mismas colecciones existen en español en /es y en inglés en /en.',
          },
        ],
      },
    },
  },
  {
    id: 'personality-tests',
    slugs: { en: 'personality-tests', es: 'tests-de-personalidad' },
    filter: { types: ['personality'] },
    limit: COLLECTION_LIMIT,
    copy: {
      en: {
        title: 'Personality tests',
        description:
          'Free personality tests that match you with a character, an era or a style. Written results made for sharing, in English and Spanish.',
        intro: [
          'Personality tests are the other half of QuizVerse: there are no right answers, only choices that lean toward one of several written profiles. Which character are you, which era fits your taste, what your playstyle says about you — each quiz ends on a result that reads like a horoscope written about something you love.',
          'Every option you pick points to a profile, and the one your answers point to most becomes your result. The quiz page previews the possible outcomes before you start, and the result screen gives you a shareable link whose preview card shows what you got, so it reads well in any chat.',
        ],
        faq: [
          {
            question: 'Are these scientific personality tests?',
            answer:
              'No. They are light quizzes made to be fun and shareable. Your result describes a character, a style or a habit — not a diagnosis.',
          },
          {
            question: 'How is my result decided?',
            answer:
              'Each option leans toward a profile and the one you lean toward most wins. The score is calculated on the server when you submit.',
          },
          {
            question: 'Can I get a different result if I play again?',
            answer:
              'Yes. Answer differently and you can land on another profile. The result screen has a play-again option for exactly that.',
          },
        ],
      },
      es: {
        title: 'Tests de personalidad',
        description:
          'Tests de personalidad gratis que te asignan un personaje, una era o un estilo. Resultados escritos para compartir, en español e inglés.',
        intro: [
          'Los tests de personalidad son la otra mitad de QuizVerse: no hay respuestas correctas, solo elecciones que se inclinan hacia uno de varios perfiles escritos. Qué personaje eres, qué era va con tu gusto, qué dice tu forma de jugar de ti — cada quiz termina en un resultado que se lee como un horóscopo escrito sobre algo que te gusta.',
          'Cada opción que eliges apunta a un perfil, y el que más se repite en tus respuestas es tu resultado. La página del quiz adelanta los resultados posibles antes de empezar, y la pantalla final te da un enlace para compartir cuya vista previa muestra lo que te tocó, así se entiende en cualquier chat.',
        ],
        faq: [
          {
            question: '¿Son tests de personalidad científicos?',
            answer:
              'No. Son quizzes livianos pensados para divertirse y compartir. El resultado describe un personaje, un estilo o un hábito, no un diagnóstico.',
          },
          {
            question: '¿Cómo se decide mi resultado?',
            answer:
              'Cada opción apunta a un perfil y gana el que más se repite en tus respuestas. El cálculo se hace en el servidor al enviar.',
          },
          {
            question: '¿Puedo obtener otro resultado si repito el test?',
            answer:
              'Sí. Si respondes distinto puedes caer en otro perfil. La pantalla de resultado tiene la opción de jugar de nuevo para eso.',
          },
        ],
      },
    },
  },
  {
    id: 'anime',
    slugs: { en: 'anime', es: 'anime' },
    filter: { categorySlugs: ['anime-manga'] },
    limit: COLLECTION_LIMIT,
    copy: {
      en: {
        title: 'Anime quizzes',
        description:
          'Anime and manga quizzes on the series with active fandoms: trivia on story and characters, plus personality tests that place you in the cast.',
        intro: [
          'The anime shelf is built around series with fandoms that never sleep: Attack on Titan, Jujutsu Kaisen, Solo Leveling, Witch Hat Atelier and more. Most shows get two treatments — a knowledge test on the story and its characters, and a personality quiz that matches you with the energy or role of the cast.',
          'It is one of the biggest categories on the site and the Spanish catalogue has its own anime quizzes written in Spanish. If you know a series inside out, Survival mode is where it shows: one wrong answer ends the run.',
        ],
        faq: [
          {
            question: 'Which anime series have quizzes?',
            answer:
              'Attack on Titan, Jujutsu Kaisen, Solo Leveling and Witch Hat Atelier, among others. The grid on this page lists every anime quiz currently live.',
          },
          {
            question: 'Do anime quizzes have spoilers?',
            answer:
              'Trivia rounds can mention key plot events. If you are mid-season, start with the personality quiz for that series instead.',
          },
          {
            question: 'Is there a hard mode for anime trivia?',
            answer:
              'Yes. Survival mode is on every trivia quiz: a single wrong answer ends the run, so a perfect score actually means something.',
          },
        ],
      },
      es: {
        title: 'Quizzes de anime',
        description:
          'Quizzes de anime y manga sobre las series con fandoms activos: trivia de historia y personajes, y tests que te ubican dentro del elenco.',
        intro: [
          'La sección de anime gira en torno a series con fandoms que no duermen: Attack on Titan, Jujutsu Kaisen, Solo Leveling, Witch Hat Atelier y otras. Casi todas tienen doble tratamiento: una prueba de conocimiento sobre la historia y sus personajes, y un quiz de personalidad que te empareja con la energía o el rol de su elenco.',
          'Es una de las categorías más grandes del sitio y el catálogo en español tiene sus propios quizzes de anime escritos en español. Si dominas una serie de punta a punta, el modo Supervivencia es donde se nota: un solo error termina la partida.',
        ],
        faq: [
          {
            question: '¿Qué series de anime tienen quiz?',
            answer:
              'Attack on Titan, Jujutsu Kaisen, Solo Leveling y Witch Hat Atelier, entre otras. El listado de esta página muestra todos los quizzes de anime publicados.',
          },
          {
            question: '¿Los quizzes de anime tienen spoilers?',
            answer:
              'La trivia puede mencionar giros importantes de la trama. Si vas a mitad de temporada, empieza mejor por el quiz de personalidad de esa serie.',
          },
          {
            question: '¿Hay un modo difícil para la trivia de anime?',
            answer:
              'Sí. El modo Supervivencia está en todas las trivias: un solo error termina la partida, así que un puntaje perfecto vale de verdad.',
          },
        ],
      },
    },
  },
  {
    id: 'movies-and-tv',
    slugs: { en: 'movies-and-tv', es: 'cine-y-series' },
    filter: { categorySlugs: ['movies-tv'] },
    limit: COLLECTION_LIMIT,
    copy: {
      en: {
        title: 'Movie and TV quizzes',
        description:
          'Movie and TV quizzes on what everyone is watching: fan trivia on plots and scenes, plus personality tests that cast you in the story.',
        intro: [
          'Movies and TV is the biggest shelf on QuizVerse. It follows what people are watching and arguing about right now — Marvel, Star Wars, the streaming finales everyone has an opinion on — and many titles appear twice, once as a fan trivia round and once as a personality quiz.',
          'Trivia checks plot points, characters and the scenes everyone remembers, with a verdict after every answer. Personality quizzes place you as a character or a role in the story, and the quiz page previews the possible results before you press play.',
        ],
        faq: [
          {
            question: 'Do I need to have watched the whole show to play?',
            answer:
              'For trivia it helps, since questions draw on the main plot and characters. Personality quizzes need no viewing history at all.',
          },
          {
            question: 'Can a TV trivia quiz spoil the series for me?',
            answer:
              'Trivia rounds can mention key plot events. If you are mid-season, start with the personality quiz for that show instead.',
          },
          {
            question: 'Can I share which character I got?',
            answer:
              'Yes. The result screen gives you a link whose preview card shows your character, so it reads well in any chat.',
          },
        ],
      },
      es: {
        title: 'Quizzes de cine y series',
        description:
          'Quizzes de cine y televisión sobre lo que todos están viendo: trivia de tramas y escenas, y tests que te dan un papel en la historia.',
        intro: [
          'Cine y televisión es la sección más grande de QuizVerse. Sigue lo que la gente está viendo y comentando ahora —Marvel, Star Wars, los finales del streaming de los que todos opinan— y muchos títulos aparecen dos veces: como trivia para fans y como quiz de personalidad.',
          'La trivia pregunta por tramas, personajes y las escenas que todos recuerdan, y te dice si acertaste después de cada respuesta. Los quizzes de personalidad te asignan un personaje o un papel en la historia, y la página del quiz adelanta los resultados posibles antes de jugar.',
        ],
        faq: [
          {
            question: '¿Tengo que haber visto toda la serie para jugar?',
            answer:
              'Para la trivia ayuda, porque las preguntas salen de la trama y los personajes. Los quizzes de personalidad no exigen haberla visto.',
          },
          {
            question: '¿Un quiz de trivia puede hacerme spoiler?',
            answer:
              'La trivia puede mencionar giros importantes. Si vas a mitad de temporada, empieza mejor por el quiz de personalidad de esa serie.',
          },
          {
            question: '¿Puedo compartir qué personaje me tocó?',
            answer:
              'Sí. La pantalla de resultado te da un enlace cuya vista previa muestra tu personaje, así se entiende en cualquier chat.',
          },
        ],
      },
    },
  },
  {
    id: 'party-trivia',
    slugs: { en: 'party-trivia', es: 'para-una-fiesta' },
    filter: { types: ['trivia'], maxMinutes: 4 },
    limit: COLLECTION_LIMIT,
    copy: {
      en: {
        title: 'Party trivia',
        description:
          'Short trivia rounds for a party or a hangout: quick quizzes of four minutes or less that work passing one phone around the room.',
        intro: [
          'This collection keeps only the fastest rounds on the site: trivia quizzes of four minutes or less, the kind you can pass around the room without killing the mood. One phone, a question on screen, everyone shouting an answer — that is the whole setup.',
          'Classic mode fits a group best: there is no clock, so arguing about the answer is part of the game. When the round ends, the result screen gives you a challenge link so the friend who swore they knew more can prove it.',
        ],
        faq: [
          {
            question: 'How long does a party trivia round take?',
            answer:
              'Every quiz in this collection takes four minutes or less — around eight questions that a whole group can answer in one pass.',
          },
          {
            question: 'Can we play as a group on one phone?',
            answer:
              'Yes. Everything runs in the browser with no signup, so passing one phone around the room works fine.',
          },
          {
            question: 'How do we settle who knew the most?',
            answer:
              'The result screen has a challenge link: share it and the other person sees your score before playing their own round.',
          },
        ],
      },
      es: {
        title: 'Trivia para una fiesta',
        description:
          'Rondas de trivia cortas para una fiesta o una junta: quizzes de cuatro minutos o menos que funcionan pasando un solo celular.',
        intro: [
          'Esta colección se queda solo con las rondas más rápidas del sitio: trivias de cuatro minutos o menos, de las que se pueden pasar de mano en mano sin cortar el ambiente. Un celular, una pregunta en pantalla y todos gritando la respuesta — esa es toda la preparación.',
          'El modo Clásico es el que mejor le queda a un grupo: no tiene reloj, así que discutir la respuesta es parte del juego. Al terminar la ronda, la pantalla de resultado te da un enlace de reto para que quien juraba saber más lo demuestre.',
        ],
        faq: [
          {
            question: '¿Cuánto dura una ronda de trivia de fiesta?',
            answer:
              'Todos los quizzes de esta colección duran cuatro minutos o menos: unas ocho preguntas que un grupo entero responde de una pasada.',
          },
          {
            question: '¿Podemos jugar en grupo con un solo celular?',
            answer:
              'Sí. Todo funciona en el navegador y sin registro, así que pasar un solo celular de mano en mano funciona perfecto.',
          },
          {
            question: '¿Cómo decidimos quién sabía más?',
            answer:
              'La pantalla de resultado tiene un enlace de reto: lo compartes y la otra persona ve tu puntaje antes de jugar su propia ronda.',
          },
        ],
      },
    },
  },
];

export function getCollections(): Collection[] {
  return COLLECTIONS;
}

export function getCollection(locale: Locale, slug: string): Collection | null {
  return COLLECTIONS.find((collection) => collection.slugs[locale] === slug) ?? null;
}

export function collectionPath(locale: Locale, collection: Collection): string {
  return `/${locale}/collections/${collection.slugs[locale]}`;
}

function matchesFilter(quiz: Quiz, filter: CollectionFilter): boolean {
  if (filter.types && !filter.types.includes(quiz.quiz_type)) return false;
  if (filter.categorySlugs && !filter.categorySlugs.includes(quiz.category?.slug ?? '')) {
    return false;
  }
  if (filter.maxMinutes !== undefined && quiz.estimated_minutes > filter.maxMinutes) return false;
  return true;
}

const byPlaysDesc = (a: Quiz, b: Quiz) => b.plays_count - a.plays_count;

/**
 * Resuelve los quizzes de una colección sobre un listado ya cargado.
 * Ordena por jugadas y corta en `limit`; si el filtro completo deja menos de
 * MIN_COLLECTION_QUIZZES, rellena hasta ese mínimo con los más jugados que
 * pasan sólo el filtro de tipo (o cualquiera del idioma si no hay filtro de
 * tipo), para que la landing nunca se vea vacía.
 */
export function pickCollectionQuizzes(
  collection: Collection,
  quizzes: Quiz[],
  locale: Locale
): Quiz[] {
  const inLocale = quizzes.filter((quiz) => quiz.language === locale);
  const picked = inLocale
    .filter((quiz) => matchesFilter(quiz, collection.filter))
    .sort(byPlaysDesc);

  if (picked.length < MIN_COLLECTION_QUIZZES) {
    const relaxed: CollectionFilter = { types: collection.filter.types };
    const seen = new Set(picked.map((quiz) => quiz.id));
    const filler = inLocale
      .filter((quiz) => !seen.has(quiz.id) && matchesFilter(quiz, relaxed))
      .sort(byPlaysDesc);
    picked.push(...filler.slice(0, MIN_COLLECTION_QUIZZES - picked.length));
  }

  return picked.slice(0, collection.limit);
}

/** Copy del índice `/{locale}/collections`. */
export const COLLECTIONS_INDEX_COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    heading: string;
    intro: string;
    home: string;
    label: string;
  }
> = {
  en: {
    title: 'Quiz collections',
    description:
      'Curated quiz collections on QuizVerse: trivia games, general knowledge, personality tests, anime, movies and party rounds.',
    heading: 'Collections',
    intro:
      'Six shelves of the catalogue, curated around what people actually search for. Each one gathers real published quizzes you can play right now — free, in the browser and with no signup.',
    home: 'Home',
    label: 'Collections',
  },
  es: {
    title: 'Colecciones de quizzes',
    description:
      'Colecciones de quizzes seleccionadas en QuizVerse: juegos de preguntas, cultura general, tests de personalidad, anime, cine y rondas para fiestas.',
    heading: 'Colecciones',
    intro:
      'Seis estanterías del catálogo, seleccionadas según lo que la gente busca de verdad. Cada una junta quizzes reales y publicados que puedes jugar ahora: gratis, en el navegador y sin registro.',
    home: 'Inicio',
    label: 'Colecciones',
  },
};

/** Copy de la sección de colecciones en la home. */
export const COLLECTIONS_HOME_COPY: Record<
  Locale,
  { heading: string; blurb: string; viewAll: string }
> = {
  en: {
    heading: 'Collections',
    blurb: 'Curated shelves for the broad searches: trivia, personality tests and the big fandoms.',
    viewAll: 'All collections',
  },
  es: {
    heading: 'Colecciones',
    blurb:
      'Estanterías seleccionadas para las búsquedas amplias: trivia, tests de personalidad y los fandoms grandes.',
    viewAll: 'Todas las colecciones',
  },
};

/** Etiquetas visibles reutilizadas en las landings de colección. */
export const COLLECTION_PAGE_COPY: Record<
  Locale,
  { home: string; collections: string; faqHeading: string; otherHeading: string }
> = {
  en: {
    home: 'Home',
    collections: 'Collections',
    faqHeading: 'Frequently asked questions',
    otherHeading: 'Other collections',
  },
  es: {
    home: 'Inicio',
    collections: 'Colecciones',
    faqHeading: 'Preguntas frecuentes',
    otherHeading: 'Otras colecciones',
  },
};
