import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_DIR = join(__dirname, '..', 'scripts', 'seed');
const SCRIPT = join(SEED_DIR, 'emit-editorial-seed.mjs');
const SEED_PATH = join(SEED_DIR, 'editorial-seed-2026au.json');

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
  language: string;
  category: string;
  questions: SeedQuestion[];
}

// The five animal topics as (en slug, es slug, category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-dog-breeds-trivia', 'es-trivia-razas-de-perros', 'animals'],
  ['en-cat-breeds-trivia', 'es-trivia-razas-de-gatos', 'animals'],
  ['en-birds-trivia', 'es-trivia-aves', 'animals'],
  ['en-big-cats-trivia', 'es-trivia-grandes-felinos', 'animals'],
  ['en-venomous-animals-trivia', 'es-trivia-animales-venenosos', 'animals'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026au', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene exactamente los 5 pares es/en por tema', () => {
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

  it('cada quiz es trivia con 8 preguntas, 4 opciones, una sola correcta y explicación', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(40);
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
        expect(question.explanation?.length, `${quiz.slug} ${question.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('título y descripción cumplen los rangos editoriales', () => {
    for (const quiz of quizzes) {
      expect(quiz.title.length, `${quiz.slug} title`).toBeGreaterThanOrEqual(30);
      expect(quiz.title.length, `${quiz.slug} title`).toBeLessThanOrEqual(65);
      expect(quiz.description.length, `${quiz.slug} description`).toBeGreaterThanOrEqual(80);
      expect(quiz.description.length, `${quiz.slug} description`).toBeLessThanOrEqual(158);
    }
  });

  it('ningún slug del lote existe en otro lote editorial', () => {
    const batchSlugs = new Set(quizzes.map((quiz) => quiz.slug));
    const collisions: string[] = [];
    for (const name of readdirSync(SEED_DIR)) {
      if (name === 'editorial-seed-2026au.json' || !/^editorial-seed.*\.json$/.test(name)) continue;
      const other = JSON.parse(readFileSync(join(SEED_DIR, name), 'utf8')) as {
        quizzes?: { slug?: string }[];
      };
      for (const quiz of other.quizzes ?? []) {
        if (quiz.slug && batchSlugs.has(quiz.slug)) {
          collisions.push(`slug "${quiz.slug}" ya existe en ${name}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('el texto en español no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((quiz) => quiz.language === 'es')) {
      const text = [
        quiz.title,
        quiz.description,
        ...quiz.questions.flatMap((question) => [
          question.question,
          question.explanation ?? '',
          ...question.options.map((option) => option.text),
        ]),
      ].join(' ');
      expect(VOSEO.test(text), `${quiz.slug}: ${text.match(VOSEO)?.[0]}`).toBe(false);
    }
  });
});
