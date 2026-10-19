import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026k.json');

interface SeedOption {
  id: string;
  text: string;
  is_correct?: boolean;
}

interface SeedQuestion {
  id: string;
  question: string;
  options: SeedOption[];
}

interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  quiz_type: string;
  language: string;
  category: string;
  tags?: string[];
  questions: SeedQuestion[];
}

// Same list the emitter validates against (scripts/seed/emit-editorial-seed.mjs).
const REPO_CATEGORIES = new Set([
  'personality',
  'movies-tv',
  'culture',
  'music',
  'lifestyle',
  'gaming',
  'science',
  'history',
  'sports',
  'geography',
  'anime-manga',
  'food-drink',
  'literature',
  'technology',
  'pop-culture',
  'animals',
  'relationships',
]);

// The five evergreen topics as (en slug, es slug, category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-solar-system-planets-trivia', 'es-trivia-planetas-del-sistema-solar', 'science'],
  ['en-everyday-chemistry-trivia', 'es-trivia-quimica-de-lo-cotidiano', 'science'],
  ['en-chess-trivia', 'es-trivia-ajedrez', 'sports'],
  ['en-aviation-history-trivia', 'es-trivia-historia-de-la-aviacion', 'history'],
  ['en-nutrition-basics-trivia', 'es-trivia-nutricion-y-alimentacion', 'food-drink'],
];

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026k', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene exactamente 10 quizzes: 5 en inglés y 5 en español', () => {
    expect(quizzes).toHaveLength(10);
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(5);
  });

  it('los slugs son únicos y empiezan por el prefijo de su idioma', () => {
    const slugs = quizzes.map((quiz) => quiz.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const quiz of quizzes) {
      expect(quiz.slug, quiz.slug).toMatch(/^[a-z0-9-]+$/);
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('cada par es/en cubre un tema distinto con su categoría esperada', () => {
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    const topics = new Set(EXPECTED_PAIRS.map(([enSlug]) => enSlug));
    expect(topics.size).toBe(5);
    for (const [enSlug, esSlug, category] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe(category);
      expect(es!.category).toBe(category);
      // Sin entrada en el mapa de locales, el switcher y los hreflang caen a home.
      expect(getEquivalentQuizSlug(enSlug, 'es'), enSlug).toBe(esSlug);
      expect(getEquivalentQuizSlug(esSlug, 'en'), esSlug).toBe(enSlug);
    }
  });

  it('toda categoría existe en la lista del repo', () => {
    for (const quiz of quizzes) {
      expect(REPO_CATEGORIES.has(quiz.category), quiz.slug).toBe(true);
    }
  });

  it('cada trivia tiene 8 preguntas, >=4 opciones y exactamente una correcta', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeGreaterThanOrEqual(4);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
        for (const option of question.options) {
          expect(
            option.text.trim().length,
            `${quiz.slug} ${question.id}/${option.id}`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('descripciones >=40 caracteres, títulos de 30 a 65 y 3-6 tags', () => {
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(40);
      expect(quiz.title.length, quiz.slug).toBeGreaterThanOrEqual(30);
      expect(quiz.title.length, quiz.slug).toBeLessThanOrEqual(65);
      expect(quiz.tags?.length ?? 0, quiz.slug).toBeGreaterThanOrEqual(3);
      expect(quiz.tags?.length ?? 0, quiz.slug).toBeLessThanOrEqual(6);
    }
  });
});
