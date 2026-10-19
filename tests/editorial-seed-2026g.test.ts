import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026g.json');

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

// Each pair shares one topic: an en- and an es- slug covering the same subject.
const PAIRS: Array<[string, string]> = [
  ['en-dinosaurs-trivia', 'es-trivia-dinosaurios'],
  ['en-pre-columbian-civilizations-trivia', 'es-trivia-civilizaciones-precolombinas'],
  ['en-norse-mythology-trivia', 'es-trivia-mitologia-nordica'],
  ['en-great-explorers-trivia', 'es-trivia-grandes-exploradores'],
  ['en-80s-movies-trivia', 'es-trivia-peliculas-de-los-80'],
];

// Neutral Spanish only: no Rioplatense voseo forms in any es- text.
const VOSEO =
  /\b(vos|tenés|querés|podés|sabés|hacés|decís|venís|andá|mirá|hacé|decí|fijate|acordate)\b/i;

interface SeedOption {
  text: string;
  is_correct: boolean;
}

interface SeedQuestion {
  question: string;
  options: SeedOption[];
  explanation?: string;
}

interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  language: 'en' | 'es';
  category: string;
  questions: SeedQuestion[];
}

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] };

function runEmitter() {
  try {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
}

function spanishTexts(quiz: SeedQuiz): string[] {
  return [
    quiz.title,
    quiz.description,
    ...quiz.questions.flatMap((question) => [
      question.question,
      question.explanation ?? '',
      ...question.options.map((option) => option.text),
    ]),
  ];
}

describe('editorial-seed-2026g', () => {
  it('pasa la validación del emisor real', () => {
    const { status, stdout, stderr } = runEmitter();
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene 5 pares es/en (10 quizzes), uno por tema', () => {
    expect(seed.quizzes).toHaveLength(10);
    for (const [enSlug, esSlug] of PAIRS) {
      const en = seed.quizzes.find((quiz) => quiz.slug === enSlug);
      const es = seed.quizzes.find((quiz) => quiz.slug === esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe(es!.category);
      expect(en!.questions.length).toBe(es!.questions.length);
    }
  });

  it('da 6-8 preguntas por quiz, con una sola opción correcta', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        expect(question.options.filter((option) => option.is_correct === true)).toHaveLength(1);
      }
    }
  });

  it('mantiene descripciones de al menos 40 caracteres', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(40);
    }
  });

  it('usa solo categorías conocidas por el emisor', () => {
    for (const quiz of seed.quizzes) {
      expect(CATEGORIES.has(quiz.category), `${quiz.slug}: ${quiz.category}`).toBe(true);
    }
  });

  it('usa slugs únicos con el prefijo de idioma correcto', () => {
    const slugs = seed.quizzes.map((quiz) => quiz.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const quiz of seed.quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('no usa voseo en los textos en español', () => {
    for (const quiz of seed.quizzes.filter((quiz) => quiz.language === 'es')) {
      for (const text of spanishTexts(quiz)) {
        expect(VOSEO.test(text), `${quiz.slug}: "${text}"`).toBe(false);
      }
    }
  });
});
