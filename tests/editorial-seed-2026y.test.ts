import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EMITTER = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026y.json');

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

// Los cinco temas del lote 2026y como (slug en, slug es, categoría).
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-el-chavo-del-8-trivia', 'es-trivia-el-chavo-del-8', 'pop-culture'],
  ['en-el-chapulin-colorado-trivia', 'es-trivia-el-chapulin-colorado', 'pop-culture'],
  ['en-classic-telenovelas-trivia', 'es-trivia-telenovelas-clasicas', 'movies-tv'],
  ['en-latin-tv-90s-trivia', 'es-trivia-programas-tv-latinos-90', 'pop-culture'],
  ['en-latin-dubbing-voices-trivia', 'es-trivia-doblaje-latino', 'movies-tv'],
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

describe('editorial-seed-2026y', () => {
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

  it('respeta los rangos editoriales de título y descripción', () => {
    for (const quiz of quizzes) {
      expect(quiz.title.length, quiz.slug).toBeGreaterThanOrEqual(30);
      expect(quiz.title.length, quiz.slug).toBeLessThanOrEqual(65);
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(80);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(158);
    }
  });

  it('cada quiz es trivia de 8 preguntas, 4 opciones y una sola correcta', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.questions, quiz.slug).toHaveLength(8);
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
