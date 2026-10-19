import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026d.json');
const EMITTER = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');

// Keep in sync with the CATEGORIES allowlist in emit-editorial-seed.mjs.
const CATEGORIES = new Set([
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

// Rioplatense voseo and peninsular vosotros forms are off-limits: the catalogue
// uses neutral Spanish ("pon a prueba", not "poné").
const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/i;

interface SeedOption {
  id: string;
  text: string;
  is_correct?: boolean;
}

interface SeedQuestion {
  id: string;
  question: string;
  options: SeedOption[];
  explanation?: string;
}

interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  quiz_type: string;
  difficulty: string;
  language: string;
  category: string;
  tags: string[];
  estimated_minutes: number;
  questions: SeedQuestion[];
}

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] };
const quizzes = seed.quizzes;

const EXPECTED_PAIRS: [string, string][] = [
  ['en-ancient-rome-trivia', 'es-trivia-antigua-roma'],
  ['en-ancient-egypt-trivia', 'es-trivia-antiguo-egipto'],
  ['en-world-war-2-trivia', 'es-trivia-segunda-guerra-mundial'],
  ['en-nba-trivia', 'es-trivia-nba'],
  ['en-oscars-trivia', 'es-trivia-premios-oscar'],
];

describe('editorial-seed-2026d', () => {
  it('pasa la validación del emisor real (exit 0)', () => {
    const stdout = execFileSync('node', [EMITTER, '--input', SEED_PATH], { encoding: 'utf8' });
    expect(stdout).toContain('insert into public.quizzes');
  });

  it('contiene exactamente 10 quizzes', () => {
    expect(quizzes).toHaveLength(10);
  });

  it('tiene los 5 pares es/en completos, con misma categoría y mismo número de preguntas', () => {
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe(es!.category);
      expect(en!.questions.length).toBe(es!.questions.length);
    }
  });

  it('los slugs son únicos, ASCII y llevan el prefijo de idioma', () => {
    const slugs = quizzes.map((quiz) => quiz.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const quiz of quizzes) {
      expect(quiz.slug).toMatch(/^[a-z0-9-]+$/);
      expect(quiz.slug.startsWith(`${quiz.language}-`)).toBe(true);
    }
  });

  it('cada quiz es trivia con categoría permitida, título ≥10 y descripción ≥40', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type).toBe('trivia');
      expect(CATEGORIES.has(quiz.category)).toBe(true);
      expect(quiz.title.length).toBeGreaterThanOrEqual(10);
      expect(quiz.description.length).toBeGreaterThanOrEqual(40);
      expect(quiz.estimated_minutes).toBeGreaterThanOrEqual(3);
      expect(quiz.estimated_minutes).toBeLessThanOrEqual(5);
      expect(quiz.tags.length).toBeGreaterThan(0);
    }
  });

  it('cada quiz tiene 6-8 preguntas con una sola opción correcta y explicación', () => {
    for (const quiz of quizzes) {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} → "${question.question}"`).toHaveLength(1);
        expect(question.explanation?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('el español es neutro: sin voseo ni formas de vosotros', () => {
    for (const quiz of quizzes.filter((q) => q.language === 'es')) {
      const text = [
        quiz.title,
        quiz.description,
        ...quiz.tags,
        ...quiz.questions.flatMap((question) => [
          question.question,
          question.explanation ?? '',
          ...question.options.map((option) => option.text),
        ]),
      ].join(' ');
      expect(VOSEO.test(text), `${quiz.slug} contiene voseo`).toBe(false);
    }
  });
});
