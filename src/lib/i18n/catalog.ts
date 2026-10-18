import type { Category, Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';

const CATEGORY_COPY = {
  personality: {
    en: {
      name: 'Personality',
      description: 'Identity reads, instincts and social chemistry.',
    },
    es: {
      name: 'Personalidad',
      description: 'Lecturas de identidad, instinto y química social.',
    },
  },
  trivia: {
    en: {
      name: 'Trivia',
      description: 'Sharp rounds with clean reveals and fast pacing.',
    },
    es: {
      name: 'Trivia',
      description: 'Rondas ágiles con respuestas claras y ritmo rápido.',
    },
  },
  culture: {
    en: {
      name: 'Culture',
      description: 'Series, cinema, internet, books and shared references.',
    },
    es: {
      name: 'Cultura',
      description: 'Series, cine, internet, libros y referencias compartidas.',
    },
  },
  lifestyle: {
    en: {
      name: 'Lifestyle',
      description: 'Taste, routines, rituals and everyday style.',
    },
    es: {
      name: 'Estilo de vida',
      description: 'Gusto, rutinas, rituales y estilo de todos los días.',
    },
  },
} as const;

const CATEGORY_ES_NAMES: Record<string, string> = {
  'movies & tv': 'Cine y televisión',
  music: 'Música',
  gaming: 'Videojuegos',
  science: 'Ciencia',
  history: 'Historia',
  sports: 'Deportes',
  geography: 'Geografía',
  'anime & manga': 'Anime y manga',
  'food & drink': 'Comida y bebida',
  literature: 'Literatura',
  technology: 'Tecnología',
  'pop culture': 'Cultura pop',
  animals: 'Animales',
  relationships: 'Relaciones',
};

const TYPE_COPY = {
  personality: { en: 'Personality', es: 'Personalidad' },
  trivia: { en: 'Trivia', es: 'Trivia' },
  poll: { en: 'Poll', es: 'Encuesta' },
} as const;

const DIFFICULTY_COPY = {
  easy: { en: 'Easy', es: 'Suave' },
  medium: { en: 'Medium', es: 'Media' },
  hard: { en: 'Hard', es: 'Alta' },
} as const;

export function localizeCategory(
  category: Category | null | undefined,
  locale: Locale
): Category | null {
  if (!category) return null;

  const localized = CATEGORY_COPY[category.slug as keyof typeof CATEGORY_COPY];
  if (!localized) {
    return locale === 'es'
      ? { ...category, name: CATEGORY_ES_NAMES[category.name.toLowerCase()] ?? category.name }
      : category;
  }

  return {
    ...category,
    name: localized[locale].name,
    description: localized[locale].description,
  };
}

export function localizeQuizCategory(quiz: Quiz, locale: Locale): Quiz {
  return {
    ...quiz,
    category: localizeCategory(quiz.category, locale),
  };
}

export function localizeQuizList(quizzes: Quiz[], locale: Locale): Quiz[] {
  return quizzes.map((quiz) => localizeQuizCategory(quiz, locale));
}

export function getLocalizedCategoryLabel(
  slug: keyof typeof CATEGORY_COPY | string,
  locale: Locale
) {
  const localized = CATEGORY_COPY[slug as keyof typeof CATEGORY_COPY];
  return localized
    ? localized[locale].name
    : locale === 'es'
      ? (CATEGORY_ES_NAMES[slug.toLowerCase()] ?? slug)
      : slug;
}

export function getLocalizedTypeLabel(type: Quiz['quiz_type'], locale: Locale) {
  return TYPE_COPY[type][locale];
}

export function getLocalizedDifficultyLabel(difficulty: Quiz['difficulty'], locale: Locale) {
  return DIFFICULTY_COPY[difficulty][locale];
}

export function getLocalizedLanguageLabel(language: string, locale: Locale) {
  if (language === 'es') {
    return locale === 'es' ? 'Español' : 'Spanish';
  }

  if (language === 'en') {
    return locale === 'es' ? 'Inglés' : 'English';
  }

  return language.toUpperCase();
}
