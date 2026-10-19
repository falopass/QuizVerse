import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026bq.json');

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
  difficulty: string;
  estimated_minutes: number;
  tags: string[];
  questions: SeedQuestion[];
}

// The five sky/space/AI topics as (en slug, es slug, category) pairs.
// en-artificial-intelligence-trivia/es-trivia-inteligencia-artificial ya los cubre el lote 2026aw
// y en-space-missions-trivia/es-trivia-misiones-espaciales el lote base.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-solar-eclipse-2026-trivia', 'es-trivia-eclipse-solar-2026', 'science'],
  ['en-generative-ai-trivia', 'es-trivia-ia-generativa', 'technology'],
  ['en-artemis-program-trivia', 'es-trivia-programa-artemis', 'science'],
  ['en-space-telescopes-trivia', 'es-trivia-telescopios-espaciales', 'science'],
  ['en-mars-missions-trivia', 'es-trivia-misiones-a-marte', 'science'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026bq', () => {
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

  it('cada quiz es trivia con 8 preguntas, 4 opciones y una sola correcta', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.difficulty, quiz.slug).toBe('medium');
      expect(quiz.estimated_minutes, quiz.slug).toBe(3);
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        const where = `${quiz.slug} ${question.id}`;
        expect(question.options, where).toHaveLength(4);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, where).toHaveLength(1);
        expect(question.explanation?.length ?? 0, where).toBeGreaterThan(0);
      }
    }
  });

  it('títulos, descripciones y tags respetan los límites editoriales', () => {
    for (const quiz of quizzes) {
      expect(quiz.title.length, quiz.slug).toBeGreaterThanOrEqual(30);
      expect(quiz.title.length, quiz.slug).toBeLessThanOrEqual(65);
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(80);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(158);
      expect(quiz.tags.length, quiz.slug).toBeGreaterThanOrEqual(3);
      expect(quiz.tags.length, quiz.slug).toBeLessThanOrEqual(5);
    }
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
