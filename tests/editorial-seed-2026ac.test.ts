import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EMITTER = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026ac.json');
const SEED_DIR = join(__dirname, '..', 'scripts', 'seed');
const TRENDING_SEED = join(__dirname, '..', 'generated', 'trending-seed.normalized.json');

// El lote va en español neutro: sin voseo rioplatense ni segunda persona plural ibérica.
const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/i;

const VALID_CATEGORIES = new Set([
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

interface SeedOption {
  id: string;
  text: string;
  is_correct: boolean;
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
  language: string;
  category: string;
  questions: SeedQuestion[];
}

// Los cinco temas del lote 2026ac (CONT-38, tenis) como (slug en, slug es, categoría).
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-tennis-grand-slams-trivia', 'es-trivia-tenis-grand-slams', 'sports'],
  ['en-federer-nadal-trivia', 'es-trivia-federer-nadal', 'sports'],
  ['en-djokovic-serena-trivia', 'es-trivia-djokovic-serena', 'sports'],
  ['en-tennis-surfaces-rules-trivia', 'es-trivia-tenis-superficies-reglas', 'sports'],
  ['en-tennis-history-trivia', 'es-trivia-tenis-momentos-historicos', 'sports'],
];

const quizzes = (JSON.parse(readFileSync(SEED, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

function collectStrings(value: unknown, strings: string[] = []): string[] {
  if (typeof value === 'string') {
    strings.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, strings);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, strings);
  }
  return strings;
}

function collectSlugs(file: string): string[] {
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { quizzes?: SeedQuiz[] };
  return (parsed.quizzes ?? []).map((quiz) => quiz.slug);
}

describe('editorial-seed-2026ac', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [EMITTER, '--input', SEED], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    expect(stdout).toContain('Validated:');
  });

  it('tiene exactamente los 5 pares en/es pedidos', () => {
    expect(quizzes).toHaveLength(10);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug, category] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe(category);
      expect(es!.category).toBe(category);
    }
  });

  it('cada slug lleva el prefijo de su idioma y la categoría existe', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
      expect(VALID_CATEGORIES.has(quiz.category), quiz.slug).toBe(true);
    }
  });

  it('cada quiz es trivia de 6-8 preguntas, 4 opciones y una sola correcta', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        const where = `${quiz.slug} ${question.id}`;
        expect(question.options, where).toHaveLength(4);
        expect(
          question.options.filter((option) => option.is_correct === true),
          where
        ).toHaveLength(1);
        expect(new Set(question.options.map((option) => option.id)).size, where).toBe(
          question.options.length
        );
        expect(question.explanation?.length ?? 0, where).toBeGreaterThan(0);
      }
    }
  });

  it('los slugs del lote no chocan con otros seeds ni con el catálogo normalizado', () => {
    const ownSlugs = new Set(quizzes.map((quiz) => quiz.slug));
    expect(ownSlugs.size).toBe(quizzes.length);

    const otherSlugs = new Set<string>();
    for (const file of readdirSync(SEED_DIR)) {
      if (
        file.startsWith('editorial-seed') &&
        file.endsWith('.json') &&
        file !== 'editorial-seed-2026ac.json'
      ) {
        for (const slug of collectSlugs(join(SEED_DIR, file))) otherSlugs.add(slug);
      }
    }
    if (existsSync(TRENDING_SEED)) {
      for (const slug of collectSlugs(TRENDING_SEED)) otherSlugs.add(slug);
    }

    for (const slug of ownSlugs) {
      expect(otherSlugs.has(slug), `slug duplicado: ${slug}`).toBe(false);
    }
  });

  it('el español del lote no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((item) => item.language === 'es')) {
      for (const text of collectStrings(quiz)) {
        expect(VOSEO.test(text), `${quiz.slug}: "${text}"`).toBe(false);
      }
    }
  });
});
