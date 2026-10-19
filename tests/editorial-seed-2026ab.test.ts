import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_DIR = join(__dirname, '..', 'scripts', 'seed');
const EMITTER = join(SEED_DIR, 'emit-editorial-seed.mjs');
const SEED = join(SEED_DIR, 'editorial-seed-2026ab.json');
const TRENDING = join(__dirname, '..', 'generated', 'trending-seed.normalized.json');

// El lote va en español neutro: sin voseo rioplatense ni segunda persona plural ibérica.
const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/i;

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

// Los cinco personajes del lote 2026ab como (slug en, slug es, categoría).
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-batman-trivia', 'es-trivia-batman', 'movies-tv'],
  ['en-superman-trivia', 'es-trivia-superman', 'movies-tv'],
  ['en-wonder-woman-trivia', 'es-trivia-wonder-woman', 'movies-tv'],
  ['en-flash-trivia', 'es-trivia-flash', 'movies-tv'],
  ['en-justice-league-trivia', 'es-trivia-liga-de-la-justicia', 'movies-tv'],
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

function loadSlugs(file: string): string[] {
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { quizzes?: { slug?: string }[] };
  return (parsed.quizzes ?? []).map((quiz) => quiz.slug).filter(Boolean) as string[];
}

describe('editorial-seed-2026ab', () => {
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

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
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

  it('las descripciones no superan los 158 caracteres y no se repiten', () => {
    const descriptions = new Set<string>();
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(158);
      expect(descriptions.has(quiz.description), quiz.slug).toBe(false);
      descriptions.add(quiz.description);
    }
  });

  it('ningún slug choca con otro lote editorial', () => {
    const otherBatches = readdirSync(SEED_DIR)
      .filter(
        (name) => /^editorial-seed.*\.json$/.test(name) && name !== 'editorial-seed-2026ab.json'
      )
      .map((name) => join(SEED_DIR, name));
    const taken = new Set(otherBatches.flatMap(loadSlugs));
    for (const quiz of quizzes) {
      expect(taken.has(quiz.slug), quiz.slug).toBe(false);
    }
  });

  it('ningún slug choca con el catálogo generado', () => {
    const catalogSlugs = new Set(loadSlugs(TRENDING));
    for (const quiz of quizzes) {
      expect(catalogSlugs.has(quiz.slug), quiz.slug).toBe(false);
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
