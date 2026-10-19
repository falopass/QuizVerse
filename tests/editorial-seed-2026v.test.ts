import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EMITTER = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026v.json');

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

// Los cuatro temas del lote 2026v como (slug en, slug es, categoría).
// El par marino usa es-trivia-animales-del-mar: es-trivia-animales-marinos ya
// existe en el lote 2026f y el ON CONFLICT DO NOTHING lo haría no-op.
// El par de insectos ya existía en el lote 2026ag y aquí se deduplicó.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-everyday-physics-trivia', 'es-trivia-fisica-cotidiana', 'science'],
  ['en-cell-biology-trivia', 'es-trivia-biologia-celular', 'science'],
  ['en-marine-animals-trivia', 'es-trivia-animales-del-mar', 'animals'],
  ['en-ecosystems-trivia', 'es-trivia-ecosistemas', 'science'],
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

describe('editorial-seed-2026v', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [EMITTER, '--input', SEED], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    expect(stdout).toContain('Validated:');
  });

  it('tiene exactamente los 4 pares en/es pedidos', () => {
    expect(quizzes).toHaveLength(8);
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

  it('el español del lote no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((item) => item.language === 'es')) {
      for (const text of collectStrings(quiz)) {
        expect(VOSEO.test(text), `${quiz.slug}: "${text}"`).toBe(false);
      }
    }
  });
});
