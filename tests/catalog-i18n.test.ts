import { describe, expect, it } from 'vitest';
import {
  getLocalizedCategoryLabel,
  getLocalizedDifficultyLabel,
  getLocalizedLanguageLabel,
  getLocalizedTypeLabel,
  localizeCategory,
  localizeQuizCategory,
  localizeQuizList,
} from '@/lib/i18n/catalog';
import type { Category, Quiz } from '@/types/quiz';

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  name: 'Movies & TV',
  slug: 'movies-tv',
  description: null,
  icon: null,
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 10,
  sort_order: 1,
  ...overrides,
});

const makeQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-1',
  slug: 'quiz-1',
  title: 'Quiz 1',
  description: null,
  cover_image_url: null,
  quiz_type: 'trivia',
  difficulty: 'easy',
  language: 'en',
  questions: [],
  results: null,
  tags: [],
  estimated_minutes: 5,
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

describe('localizeCategory', () => {
  it('uses curated copy for curated slugs', () => {
    const culture = makeCategory({ slug: 'culture', name: 'Culture' });

    const es = localizeCategory(culture, 'es');
    expect(es).toMatchObject({
      name: 'Cultura',
      description: 'Series, cine, internet, libros y referencias compartidas.',
    });

    const en = localizeCategory(culture, 'en');
    expect(en).toMatchObject({
      name: 'Culture',
      description: 'Series, cinema, internet, books and shared references.',
    });

    const lifestyle = localizeCategory(
      makeCategory({ slug: 'lifestyle', name: 'Lifestyle' }),
      'es'
    );
    expect(lifestyle?.name).toBe('Estilo de vida');
  });

  it('maps english names to spanish when the slug has no curated copy', () => {
    const category = makeCategory({ slug: 'movies-tv', name: 'Movies & TV' });

    expect(localizeCategory(category, 'es')?.name).toBe('Cine y televisión');
    expect(localizeCategory(category, 'en')?.name).toBe('Movies & TV');
  });

  it('keeps unmapped names as-is in spanish', () => {
    const category = makeCategory({ slug: 'unknown', name: 'Unmapped Topic' });

    expect(localizeCategory(category, 'es')?.name).toBe('Unmapped Topic');
  });

  it('returns null for null or undefined categories', () => {
    expect(localizeCategory(null, 'es')).toBeNull();
    expect(localizeCategory(undefined, 'es')).toBeNull();
  });

  it('does not mutate the original category', () => {
    const category = makeCategory({ slug: 'culture', name: 'Culture' });
    const snapshot = { ...category };

    const localized = localizeCategory(category, 'es');

    expect(category).toEqual(snapshot);
    expect(localized).not.toBe(category);
  });
});

describe('localizeQuizCategory / localizeQuizList', () => {
  it('translates the quiz category without mutating the quiz', () => {
    const quiz = makeQuiz({ category: makeCategory({ slug: 'culture', name: 'Culture' }) });
    const snapshot = { ...quiz, category: { ...quiz.category } };

    const localized = localizeQuizCategory(quiz, 'es');

    expect(localized.category?.name).toBe('Cultura');
    expect(localized).not.toBe(quiz);
    expect(quiz).toEqual(snapshot);
    expect(quiz.category?.name).toBe('Culture');
  });

  it('returns a new list with localized categories and no mutations', () => {
    const quizzes = [
      makeQuiz({ id: 'a', category: makeCategory({ slug: 'culture', name: 'Culture' }) }),
      makeQuiz({ id: 'b', category: makeCategory({ slug: 'music', name: 'Music' }) }),
    ];

    const localized = localizeQuizList(quizzes, 'es');

    expect(localized).not.toBe(quizzes);
    expect(localized[0]?.category?.name).toBe('Cultura');
    expect(localized[1]?.category?.name).toBe('Música');
    expect(quizzes[0]?.category?.name).toBe('Culture');
    expect(quizzes[1]?.category?.name).toBe('Music');
  });

  it('keeps category as null when the quiz has none', () => {
    const quiz = makeQuiz({ category: null });

    expect(localizeQuizCategory(quiz, 'es').category).toBeNull();
    expect(localizeQuizList([quiz], 'es')[0]?.category).toBeNull();
  });
});

describe('getLocalizedCategoryLabel', () => {
  it('returns curated labels for known slugs', () => {
    expect(getLocalizedCategoryLabel('culture', 'es')).toBe('Cultura');
    expect(getLocalizedCategoryLabel('culture', 'en')).toBe('Culture');
    expect(getLocalizedCategoryLabel('trivia', 'es')).toBe('Trivia');
    expect(getLocalizedCategoryLabel('personality', 'es')).toBe('Personalidad');
    expect(getLocalizedCategoryLabel('personality', 'en')).toBe('Personality');
  });

  it('maps spanish names by lowercase name and returns the value for unknown strings', () => {
    expect(getLocalizedCategoryLabel('Music', 'es')).toBe('Música');
    expect(getLocalizedCategoryLabel('unknown-slug', 'es')).toBe('unknown-slug');
    expect(getLocalizedCategoryLabel('unknown-slug', 'en')).toBe('unknown-slug');
  });
});

describe('getLocalizedTypeLabel', () => {
  it.each([
    ['trivia', 'en', 'Trivia'],
    ['trivia', 'es', 'Trivia'],
    ['personality', 'en', 'Personality'],
    ['personality', 'es', 'Personalidad'],
    ['poll', 'en', 'Poll'],
    ['poll', 'es', 'Encuesta'],
  ] as const)('returns %s in %s as %s', (type, locale, expected) => {
    expect(getLocalizedTypeLabel(type, locale)).toBe(expected);
  });
});

describe('getLocalizedDifficultyLabel', () => {
  it.each([
    ['easy', 'en', 'Easy'],
    ['easy', 'es', 'Suave'],
    ['medium', 'en', 'Medium'],
    ['medium', 'es', 'Media'],
    ['hard', 'en', 'Hard'],
    ['hard', 'es', 'Alta'],
  ] as const)('returns %s in %s as %s', (difficulty, locale, expected) => {
    expect(getLocalizedDifficultyLabel(difficulty, locale)).toBe(expected);
  });
});

describe('getLocalizedLanguageLabel', () => {
  it('translates es and en into both locales', () => {
    expect(getLocalizedLanguageLabel('es', 'es')).toBe('Español');
    expect(getLocalizedLanguageLabel('es', 'en')).toBe('Spanish');
    expect(getLocalizedLanguageLabel('en', 'es')).toBe('Inglés');
    expect(getLocalizedLanguageLabel('en', 'en')).toBe('English');
  });

  it('uppercases unknown language codes', () => {
    expect(getLocalizedLanguageLabel('pt', 'es')).toBe('PT');
    expect(getLocalizedLanguageLabel('fr', 'en')).toBe('FR');
  });
});
