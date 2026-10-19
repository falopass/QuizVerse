import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EMITTER = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026ad.json');
const SEED_DIR = join(__dirname, '..', 'scripts', 'seed');
const CATALOG = join(__dirname, '..', 'generated', 'trending-seed.normalized.json');

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

// Los cinco pares del lote 2026ad como (slug en, slug es, categoría): tres de la
// trilogía de Peter Jackson (movies-tv) y dos de los libros (literature).
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-lord-of-the-rings-trivia', 'es-trivia-el-senor-de-los-anillos', 'movies-tv'],
  ['en-lord-of-the-rings-cast-trivia', 'es-trivia-reparto-el-senor-de-los-anillos', 'movies-tv'],
  ['en-middle-earth-places-trivia', 'es-trivia-lugares-tierra-media', 'movies-tv'],
  ['en-tolkien-lore-trivia', 'es-trivia-tolkien', 'literature'],
  ['en-the-hobbit-book-trivia', 'es-trivia-el-hobbit', 'literature'],
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

describe('editorial-seed-2026ad', () => {
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
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(5);
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

  it('las descripciones son distintas y caben en una meta description', () => {
    const descriptions = quizzes.map((quiz) => quiz.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(40);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(158);
    }
  });

  it('ningún slug choca con otros lotes editoriales ni con el seed normalizado', () => {
    const ownSlugs = new Set(quizzes.map((quiz) => quiz.slug));
    expect(ownSlugs.size).toBe(quizzes.length);

    const taken = new Map<string, string>();
    for (const name of readdirSync(SEED_DIR)) {
      if (!/^editorial-seed.*\.json$/.test(name) || name === 'editorial-seed-2026ad.json') {
        continue;
      }
      const other = JSON.parse(readFileSync(join(SEED_DIR, name), 'utf8')) as {
        quizzes?: { slug?: string }[];
      };
      for (const quiz of other.quizzes ?? []) {
        if (quiz.slug) taken.set(quiz.slug, name);
      }
    }
    const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as
      | { slug?: string }[]
      | { quizzes?: { slug?: string }[] };
    const catalogQuizzes = Array.isArray(catalog) ? catalog : (catalog.quizzes ?? []);
    for (const quiz of catalogQuizzes) {
      if (quiz.slug) taken.set(quiz.slug, 'generated/trending-seed.normalized.json');
    }

    const collisions = [...ownSlugs].filter((slug) => taken.has(slug));
    expect(collisions).toEqual([]);
  });

  it('el español del lote no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((item) => item.language === 'es')) {
      for (const text of collectStrings(quiz)) {
        expect(VOSEO.test(text), `${quiz.slug}: "${text}"`).toBe(false);
      }
    }
  });
});
