import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026c.json');

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
  ['en-general-knowledge-trivia', 'es-trivia-cultura-general'],
  ['en-world-flags-trivia', 'es-trivia-banderas-del-mundo'],
  ['en-movie-quotes-trivia', 'es-trivia-frases-de-peliculas'],
  ['en-greek-mythology-trivia', 'es-trivia-mitologia-griega'],
  ['en-inventions-trivia', 'es-trivia-inventos-que-cambiaron-el-mundo'],
];

interface SeedOption {
  is_correct: boolean;
}

interface SeedQuestion {
  options: SeedOption[];
}

interface SeedQuiz {
  slug: string;
  language: 'en' | 'es';
  category: string;
  description: string;
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

describe('editorial-seed-2026c', () => {
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

  it('da al menos 6 preguntas por quiz, con una sola opción correcta', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
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
});
