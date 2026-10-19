import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026aq.json');

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
  description: string;
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

// The five food & drink topics as (en slug, es slug, category, quiz_type) tuples.
const EXPECTED_PAIRS: Array<[string, string, string, string]> = [
  ['en-world-desserts-trivia', 'es-trivia-postres-del-mundo', 'food-drink', 'trivia'],
  ['en-coffee-trivia', 'es-trivia-cafe', 'food-drink', 'trivia'],
  ['en-wine-trivia', 'es-trivia-vino', 'food-drink', 'trivia'],
  ['en-which-dessert-are-you', 'es-que-postre-eres', 'food-drink', 'personality'],
  ['en-which-coffee-are-you', 'es-que-cafe-eres', 'food-drink', 'personality'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026aq', () => {
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
    for (const [enSlug, esSlug, category, quizType] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe(category);
      expect(es!.category).toBe(category);
      expect(en!.quiz_type).toBe(quizType);
      expect(es!.quiz_type).toBe(quizType);
    }
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(5);
  });

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('las trivia tienen 8 preguntas, 2-6 opciones, una sola correcta y explicación', () => {
    for (const quiz of quizzes.filter((item) => item.quiz_type === 'trivia')) {
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

  it('las personality tienen 6-8 preguntas, tags en cada opción y 4-6 resultados alcanzables', () => {
    for (const quiz of quizzes.filter((item) => item.quiz_type === 'personality')) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      expect(quiz.results?.length ?? 0, quiz.slug).toBeGreaterThanOrEqual(4);
      expect(quiz.results?.length ?? 0, quiz.slug).toBeLessThanOrEqual(6);
      const reachable = new Set<string>();
      for (const question of quiz.questions) {
        for (const option of question.options) {
          expect(option.personality_tags?.length, `${quiz.slug} ${question.id}`).toBeGreaterThan(0);
          for (const tag of option.personality_tags ?? []) reachable.add(tag);
        }
      }
      for (const result of quiz.results ?? []) {
        expect(result.personality_tag, `${quiz.slug} ${result.id}`).toBeTruthy();
        expect(result.title.trim().length, `${quiz.slug} ${result.id}`).toBeGreaterThan(0);
        expect(result.description.trim().length, `${quiz.slug} ${result.id}`).toBeGreaterThan(0);
        expect(reachable.has(result.personality_tag!), `${quiz.slug} ${result.id}`).toBe(true);
      }
    }
  });

  it('toda description queda entre 120 y 160 caracteres', () => {
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
        ...(quiz.results ?? []).flatMap((result) => [result.title, result.description]),
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
