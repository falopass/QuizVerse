import type { Locale } from '@/lib/i18n/dictionaries';

export interface HubGuide {
  title: string;
  intro: string[];
  howTo: string[];
  closing: string;
}

export const HUB_GUIDES: Record<string, Record<Locale, HubGuide>> = {
  trivia: {
    es: {
      title: 'Trivia: preguntas directas, respuestas claras',
      intro: [
        'La trivia es el formato más viejo y más honesto del sitio: una pregunta, varias opciones y una sola respuesta correcta. Aquí no hay perfiles psicológicos ni lecturas de tu personalidad; hay datos, referencias y memoria. Cada ronda junta preguntas de un mismo tema —cine, música, videojuegos, anime, historia— y las ordena para que el ritmo no decaiga: las primeras entran fácil y las últimas exigen un poco más.',
        'Jugar es gratis y no pide registro: el puntaje llega al instante, con la corrección de cada pregunta para que veas dónde te equivocaste. Sirve para matar diez minutos, para discutir con amigos quién sabe más de una saga o para descubrir que llevas años repitiendo un dato que era falso. Si un tema te engancha, las categorías relacionadas llevan a rondas más específicas.',
      ],
      howTo: [
        'Elige un quiz y responde pregunta por pregunta, sin vuelta atrás.',
        'Al final recibes tu puntaje y la revisión de cada respuesta.',
        'Comparte el resultado o prueba otra ronda del mismo tema.',
      ],
      closing: 'Una respuesta correcta más siempre está a una ronda de distancia.',
    },
    en: {
      title: 'Trivia: straight questions, clean answers',
      intro: [
        'Trivia is the oldest and most honest format on the site: one question, a few options and a single correct answer. There are no personality reads here, just facts, references and memory. Each round gathers questions on one theme — film, music, gaming, anime, history — and orders them so the pace never dips: the first ones go down easy and the last few ask a little more of you.',
        'Playing is free and needs no signup: your score lands instantly, with a review of every question so you can see where you slipped. It works for killing ten minutes, for settling which friend knows the most about a franchise or for discovering you have been repeating a fact that was never true. If a theme hooks you, the related categories lead to more specific rounds.',
      ],
      howTo: [
        'Pick a quiz and answer question by question — no going back.',
        'At the end you get your score and a review of every answer.',
        'Share the result or try another round on the same theme.',
      ],
      closing: 'One more right answer is always one round away.',
    },
  },
  personality: {
    es: {
      title: 'Personalidad: tests que se leen como un espejo',
      intro: [
        'Los tests de personalidad funcionan distinto: ninguna opción es correcta o incorrecta, porque lo que se mide no es lo que sabes sino cómo eres. Cada respuesta suma hacia un tipo de resultado —un arquetipo, un personaje, una forma de querer o de trabajar— y el test lee el patrón completo, no preguntas sueltas. Por eso conviene responder con la primera opción que se te ocurre, no con la que te haría quedar mejor.',
        'El resultado llega al terminar: un nombre, una descripción corta y una lectura escrita para compartirse. Están pensados para compararse —«¿a ti cuál te salió?» es la mitad de la gracia— y para repetirse cuando cambia el humor o la compañía. Al final de la página hay categorías afines para seguir por ese camino: relaciones, estilo de vida, cultura.',
      ],
      howTo: [
        'Responde cada pregunta con tu primera opción, sin pensarla demasiado.',
        'Las respuestas suman hacia un resultado; no hay correctas ni incorrectas.',
        'Al cerrar, el test muestra tu tipo y una descripción para compartir.',
      ],
      closing: 'El único resultado malo es el que no se comparte.',
    },
    en: {
      title: 'Personality: tests that read like a mirror',
      intro: [
        'Personality tests work differently: no option is right or wrong, because what gets measured is not what you know but who you are. Every answer scores toward a type of result — an archetype, a character, a way of loving or of working — and the test reads the full pattern rather than any single question. That is why it pays to answer with the first option that comes to mind, not the one that would make you look better.',
        'The result lands the moment you finish: a name, a short description and a reading written to be shared. They are built to be compared — "which one did you get?" is half the fun — and to be retaken when your mood or your company changes. At the bottom of the page you will find kindred categories to keep going down that road: relationships, lifestyle, culture.',
      ],
      howTo: [
        "Answer each question with your first instinct — don't overthink it.",
        'Answers score toward a result; there are no right or wrong ones.',
        'When you finish, the test shows your type and a shareable reading.',
      ],
      closing: "The only bad result is the one you don't share.",
    },
  },
};

export const RELATED_HEADING: Record<Locale, string> = {
  es: 'Sigue explorando',
  en: 'Keep exploring',
};

export const RELATED_CATEGORIES: Record<string, string[]> = {
  trivia: ['movies-tv', 'anime-manga', 'gaming'],
  personality: ['relationships', 'lifestyle', 'culture'],
  'movies-tv': ['anime-manga', 'pop-culture', 'music'],
  'anime-manga': ['movies-tv', 'gaming', 'pop-culture'],
  gaming: ['anime-manga', 'technology', 'movies-tv'],
  music: ['movies-tv', 'pop-culture', 'culture'],
  lifestyle: ['relationships', 'food-drink', 'culture'],
  culture: ['literature', 'pop-culture', 'movies-tv'],
  literature: ['culture', 'history', 'movies-tv'],
  'pop-culture': ['movies-tv', 'music', 'anime-manga'],
  technology: ['gaming', 'science', 'pop-culture'],
  relationships: ['lifestyle', 'culture', 'literature'],
  'food-drink': ['lifestyle', 'geography', 'culture'],
  science: ['technology', 'history', 'geography'],
  animals: ['science', 'geography', 'lifestyle'],
  sports: ['gaming', 'geography', 'history'],
  geography: ['history', 'science', 'culture'],
  history: ['geography', 'literature', 'culture'],
};

export function getHubGuide(slug: string, locale: Locale): HubGuide | null {
  return HUB_GUIDES[slug]?.[locale] ?? null;
}

export function getRelatedCategories(slug: string, availableSlugs: string[]): string[] {
  const available = new Set(availableSlugs);
  return (RELATED_CATEGORIES[slug] ?? [])
    .filter((related) => related !== slug && available.has(related))
    .slice(0, 3);
}
