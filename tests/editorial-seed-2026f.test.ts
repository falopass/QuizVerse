import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026f.json');

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

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

// Each pair shares one topic: an en- and an es- slug covering the same subject.
const PAIRS: Array<[string, string]> = [
  ['en-olympics-trivia', 'es-trivia-juegos-olimpicos'],
  ['en-tennis-trivia', 'es-trivia-tenis'],
  ['en-classical-music-trivia', 'es-trivia-musica-clasica'],
  ['en-famous-painters-trivia', 'es-trivia-pintores-famosos'],
  ['en-sea-animals-trivia', 'es-trivia-animales-marinos'],
];

// Voseo forms that must never appear in neutral Spanish copy.
const VOSEO =
  /\b(vos|sos|querés|tenés|podés|sabés|hacés|decís|vení|mirá|andá|hablás|usás|elegís)\b/i;

interface SeedOption {
  id: string;
  text: string;
  is_correct: boolean;
}

interface SeedQuestion {
  id: string;
  question: string;
  options: SeedOption[];
  explanation: string;
}

interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  quiz_type: string;
  difficulty: string;
  language: 'en' | 'es';
  category: string;
  tags: string[];
  estimated_minutes: number;
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

describe('editorial-seed-2026f', () => {
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

  it('da entre 6 y 8 preguntas por quiz, con una sola opción correcta', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeGreaterThanOrEqual(2);
        expect(question.options.filter((option) => option.is_correct === true)).toHaveLength(1);
        const ids = question.options.map((option) => option.id);
        expect(new Set(ids).size, `${quiz.slug} ${question.id}`).toBe(ids.length);
        expect(question.explanation.trim().length, `${quiz.slug} ${question.id}`).toBeGreaterThan(
          0
        );
      }
    }
  });

  it('mantiene títulos y descripciones dentro de las longitudes mínimas', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.title.length, quiz.slug).toBeGreaterThanOrEqual(10);
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(40);
      expect(quiz.estimated_minutes, quiz.slug).toBeGreaterThanOrEqual(3);
      expect(quiz.estimated_minutes, quiz.slug).toBeLessThanOrEqual(5);
      expect(DIFFICULTIES.has(quiz.difficulty), `${quiz.slug}: ${quiz.difficulty}`).toBe(true);
      expect(quiz.tags.length, quiz.slug).toBeGreaterThan(0);
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
      expect(quiz.slug, quiz.slug).toMatch(/^[a-z0-9-]+$/);
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('no choca con los slugs del seed editorial base', () => {
    const baseSeed = JSON.parse(
      readFileSync(join(__dirname, '..', 'scripts', 'seed', 'editorial-seed.json'), 'utf8')
    ) as { quizzes: Array<{ slug: string }> };
    const baseSlugs = new Set(baseSeed.quizzes.map((quiz) => quiz.slug));
    for (const quiz of seed.quizzes) {
      expect(baseSlugs.has(quiz.slug), quiz.slug).toBe(false);
    }
  });

  it('escribe el español neutro, sin voseo', () => {
    for (const quiz of seed.quizzes.filter((item) => item.language === 'es')) {
      const copy = [
        quiz.title,
        quiz.description,
        ...quiz.tags,
        ...quiz.questions.flatMap((question) => [
          question.question,
          question.explanation,
          ...question.options.map((option) => option.text),
        ]),
      ].join(' ');
      expect(VOSEO.test(copy), quiz.slug).toBe(false);
    }
  });
});
