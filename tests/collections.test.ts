/**
 * Contrato de las colecciones editoriales (SEO-33): slugs únicos y
 * resolubles por idioma, copy completo (2 párrafos + 3 FAQ) en en/es y la
 * lógica pura de pickCollectionQuizzes (filtro, orden y límite).
 */

import { describe, expect, it } from 'vitest';
import {
  COLLECTIONS,
  MIN_COLLECTION_QUIZZES,
  getCollection,
  getCollections,
  pickCollectionQuizzes,
} from '@/lib/content/collections';
import { faqNode } from '@/lib/seo/structured-data';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { Category, Quiz } from '@/types/quiz';

const LOCALES: Locale[] = ['en', 'es'];

const makeCategory = (slug: string): Category => ({
  id: slug,
  slug,
  name: slug,
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 0,
  sort_order: 0,
});

const makeQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-1',
  slug: 'quiz-1',
  title: 'Quiz 1',
  description: null,
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'easy',
  language: 'es',
  questions: [],
  results: null,
  tags: [],
  estimated_minutes: 4,
  plays_count: 0,
  shares_count: 0,
  avg_score: null,
  likes_count: 0,
  status: 'published',
  is_featured: false,
  is_ai_generated: false,
  published_at: null,
  updated_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const byId = (id: string) => COLLECTIONS.find((collection) => collection.id === id)!;

describe('COLLECTIONS', () => {
  it('tiene las 6 colecciones del encargo con sus slugs por idioma', () => {
    expect(getCollections()).toHaveLength(6);
    expect(byId('trivia-games').slugs).toEqual({ en: 'trivia-games', es: 'juegos-de-preguntas' });
    expect(byId('general-knowledge').slugs).toEqual({
      en: 'general-knowledge',
      es: 'cultura-general',
    });
    expect(byId('personality-tests').slugs).toEqual({
      en: 'personality-tests',
      es: 'tests-de-personalidad',
    });
    expect(byId('anime').slugs).toEqual({ en: 'anime', es: 'anime' });
    expect(byId('movies-and-tv').slugs).toEqual({ en: 'movies-and-tv', es: 'cine-y-series' });
    expect(byId('party-trivia').slugs).toEqual({ en: 'party-trivia', es: 'para-una-fiesta' });
  });

  it('los slugs son únicos dentro de cada idioma', () => {
    for (const locale of LOCALES) {
      const slugs = COLLECTIONS.map((collection) => collection.slugs[locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('cada colección trae 2 párrafos de intro y 3 FAQ no vacíos en ambos idiomas', () => {
    for (const collection of COLLECTIONS) {
      for (const locale of LOCALES) {
        const copy = collection.copy[locale];
        expect(copy.title.trim()).not.toBe('');
        expect(copy.description.trim()).not.toBe('');
        expect(copy.intro).toHaveLength(2);
        expect(copy.intro.every((paragraph) => paragraph.trim() !== '')).toBe(true);
        expect(copy.faq).toHaveLength(3);
        for (const item of copy.faq) {
          expect(item.question.trim()).not.toBe('');
          expect(item.answer.trim()).not.toBe('');
        }
      }
    }
  });
});

describe('getCollection', () => {
  it('resuelve la misma colección por su slug en cada idioma', () => {
    const expected = byId('party-trivia');
    expect(getCollection('en', 'party-trivia')).toBe(expected);
    expect(getCollection('es', 'para-una-fiesta')).toBe(expected);
  });

  it('no acepta el slug del otro idioma ni slugs desconocidos', () => {
    expect(getCollection('en', 'para-una-fiesta')).toBeNull();
    expect(getCollection('es', 'party-trivia')).toBeNull();
    expect(getCollection('en', 'no-existe')).toBeNull();
  });
});

describe('pickCollectionQuizzes', () => {
  it('filtra por tipo de quiz', () => {
    const collection = byId('personality-tests');
    const quizzes = [
      ...Array.from({ length: 9 }, (_, index) =>
        makeQuiz({ id: `p${index}`, quiz_type: 'personality' })
      ),
      makeQuiz({ id: 't1', quiz_type: 'trivia', plays_count: 999 }),
    ];
    const picked = pickCollectionQuizzes(collection, quizzes, 'es');
    expect(picked).toHaveLength(9);
    expect(picked.every((quiz) => quiz.quiz_type === 'personality')).toBe(true);
  });

  it('filtra por slug de categoría', () => {
    const collection = byId('anime');
    const quizzes = [
      ...Array.from({ length: 9 }, (_, index) =>
        makeQuiz({ id: `a${index}`, category: makeCategory('anime-manga') })
      ),
      makeQuiz({ id: 'g1', category: makeCategory('gaming'), plays_count: 999 }),
    ];
    const picked = pickCollectionQuizzes(collection, quizzes, 'es');
    expect(picked).toHaveLength(9);
    expect(picked.every((quiz) => quiz.category?.slug === 'anime-manga')).toBe(true);
  });

  it('filtra por duración máxima', () => {
    const collection = byId('party-trivia');
    const quizzes = [
      ...Array.from({ length: 9 }, (_, index) =>
        makeQuiz({ id: `s${index}`, estimated_minutes: 3 })
      ),
      makeQuiz({ id: 'long', estimated_minutes: 6, plays_count: 999 }),
      makeQuiz({ id: 'persona', quiz_type: 'personality', estimated_minutes: 2, plays_count: 999 }),
    ];
    const picked = pickCollectionQuizzes(collection, quizzes, 'es');
    expect(picked.map((quiz) => quiz.id)).not.toContain('long');
    expect(picked.map((quiz) => quiz.id)).not.toContain('persona');
    expect(picked.every((quiz) => quiz.estimated_minutes <= 4)).toBe(true);
  });

  it('ordena por plays_count descendente y corta en el límite', () => {
    const collection = byId('trivia-games');
    const quizzes = Array.from({ length: collection.limit + 4 }, (_, index) =>
      makeQuiz({ id: `q${index}`, plays_count: index })
    );
    const picked = pickCollectionQuizzes(collection, quizzes, 'es');
    expect(picked).toHaveLength(collection.limit);
    expect(picked[0].plays_count).toBe(collection.limit + 3);
    expect(
      picked.every(
        (quiz, index) => index === 0 || picked[index - 1].plays_count >= quiz.plays_count
      )
    ).toBe(true);
  });

  it('ignora quizzes de otro idioma', () => {
    const collection = byId('trivia-games');
    const quizzes = [
      makeQuiz({ id: 'es1', language: 'es' }),
      makeQuiz({ id: 'en1', language: 'en' }),
    ];
    const picked = pickCollectionQuizzes(collection, quizzes, 'es');
    expect(picked.map((quiz) => quiz.id)).toEqual(['es1']);
  });

  it('rellena hasta el mínimo con quizzes que pasan el filtro de tipo', () => {
    const collection = byId('party-trivia'); // trivia ≤ 4 min
    const quizzes = [
      makeQuiz({ id: 'short-1', quiz_type: 'trivia', estimated_minutes: 3, plays_count: 10 }),
      makeQuiz({ id: 'long-1', quiz_type: 'trivia', estimated_minutes: 8, plays_count: 90 }),
      makeQuiz({ id: 'long-2', quiz_type: 'trivia', estimated_minutes: 6, plays_count: 80 }),
      ...Array.from({ length: 6 }, (_, index) =>
        makeQuiz({
          id: `long-x${index}`,
          quiz_type: 'trivia',
          estimated_minutes: 7,
          plays_count: index,
        })
      ),
      makeQuiz({ id: 'persona', quiz_type: 'personality', estimated_minutes: 2, plays_count: 100 }),
    ];
    const picked = pickCollectionQuizzes(collection, quizzes, 'es');
    expect(picked).toHaveLength(MIN_COLLECTION_QUIZZES);
    expect(picked[0].id).toBe('short-1');
    // El relleno entra por plays_count y nunca incluye otro tipo de quiz.
    expect(picked[1].id).toBe('long-1');
    expect(picked.every((quiz) => quiz.quiz_type === 'trivia')).toBe(true);
  });
});

describe('FAQ estructurada', () => {
  it('faqNode emite 3 mainEntity con acceptedAnswer no vacío por colección e idioma', () => {
    for (const collection of COLLECTIONS) {
      for (const locale of LOCALES) {
        const node = faqNode(collection.copy[locale].faq);
        expect(node?.['@type']).toBe('FAQPage');
        const entities = node?.mainEntity as Array<{
          name: string;
          acceptedAnswer: { text: string };
        }>;
        expect(entities).toHaveLength(3);
        for (const entity of entities) {
          expect(entity.name.trim()).not.toBe('');
          expect(entity.acceptedAnswer.text.trim()).not.toBe('');
        }
      }
    }
  });
});
