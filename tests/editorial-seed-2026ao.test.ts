import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026ao.json');

interface SeedOption {
  id: string;
  text: string;
  is_correct?: boolean;
  personality_tags?: string[];
}

interface SeedQuestion {
  id: string;
  question: string;
  options: SeedOption[];
  explanation?: string | null;
}

interface SeedResult {
  id: string;
  title: string;
  personality_tag?: string;
}

interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  quiz_type: string;
  language: string;
  category: string;
  questions: SeedQuestion[];
  results?: SeedResult[];
}

// The five animal topics as (en slug, es slug) pairs; all live in `animals`.
const EXPECTED_PAIRS: Array<[string, string]> = [
  ['en-dinosaur-myths-trivia', 'es-trivia-mitos-de-dinosaurios'],
  ['en-birds-of-prey-and-migration-trivia', 'es-trivia-aves-rapaces-y-migracion'],
  ['en-apex-predators-trivia', 'es-trivia-superdepredadores'],
  ['en-which-bird-are-you', 'es-que-ave-eres'],
  ['en-which-predator-would-you-be', 'es-que-depredador-serias'],
];

const TRIVIA_SLUGS = new Set(EXPECTED_PAIRS.flat().slice(0, 6));

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026ao', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene exactamente los 5 pares es/en por tema, todos en animals', () => {
    expect(quizzes).toHaveLength(10);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe('animals');
      expect(es!.category).toBe('animals');
      expect(en!.quiz_type).toBe(es!.quiz_type);
    }
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(5);
  });

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('la trivia trae 8 preguntas, 2-6 opciones, una sola correcta y explanation', () => {
    for (const quiz of quizzes.filter((quiz) => TRIVIA_SLUGS.has(quiz.slug))) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeGreaterThanOrEqual(2);
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeLessThanOrEqual(6);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
        expect(question.explanation?.trim().length, `${quiz.slug} ${question.id}`).toBeGreaterThan(
          0
        );
      }
    }
  });

  it('los de personalidad traen 6-8 preguntas, tags y 4-6 resultados', () => {
    for (const quiz of quizzes.filter((quiz) => !TRIVIA_SLUGS.has(quiz.slug))) {
      expect(quiz.quiz_type, quiz.slug).toBe('personality');
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      expect(quiz.results!.length, quiz.slug).toBeGreaterThanOrEqual(4);
      expect(quiz.results!.length, quiz.slug).toBeLessThanOrEqual(6);
      const resultTags = new Set(quiz.results!.map((result) => result.personality_tag));
      for (const question of quiz.questions) {
        for (const option of question.options) {
          expect(option.personality_tags?.length, `${quiz.slug} ${question.id}`).toBeGreaterThan(0);
          for (const tag of option.personality_tags!) {
            expect(resultTags.has(tag), `${quiz.slug} ${question.id} tag ${tag}`).toBe(true);
          }
        }
      }
    }
  });

  it('las descripciones quedan entre 120 y 160 caracteres', () => {
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(120);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(160);
    }
  });

  it('el texto en español no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((quiz) => quiz.language === 'es')) {
      const text = [
        quiz.title,
        quiz.description,
        ...(quiz.results ?? []).flatMap((result) => [result.title, result.personality_tag ?? '']),
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
