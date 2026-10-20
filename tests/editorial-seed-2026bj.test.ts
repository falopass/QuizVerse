import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026bj.json');

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
  difficulty: string;
  language: string;
  category: string;
  tags: string[];
  estimated_minutes: number;
  questions: SeedQuestion[];
}

// The five language topics as (en slug, es slug, category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-spelling-trivia', 'es-trivia-ortografia', 'culture'],
  ['en-grammar-rules-trivia', 'es-trivia-gramatica', 'culture'],
  ['en-word-origins-trivia', 'es-trivia-origen-de-las-palabras', 'culture'],
  ['en-synonyms-and-antonyms-trivia', 'es-trivia-sinonimos-y-antonimos', 'culture'],
  ['en-common-writing-mistakes-trivia', 'es-trivia-errores-al-escribir', 'culture'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026bj', () => {
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

  it('cada par está enlazado en el mapa de idiomas', () => {
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      expect(getEquivalentQuizSlug(enSlug, 'es'), enSlug).toBe(esSlug);
      expect(getEquivalentQuizSlug(esSlug, 'en'), esSlug).toBe(enSlug);
    }
  });

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('cada quiz es trivia con 6-8 preguntas, 4 opciones y una sola correcta', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(['easy', 'medium'], quiz.slug).toContain(quiz.difficulty);
      expect(quiz.estimated_minutes, quiz.slug).toBeGreaterThanOrEqual(3);
      expect(quiz.estimated_minutes, quiz.slug).toBeLessThanOrEqual(4);
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
      }
    }
  });

  it('la respuesta correcta varía de posición dentro de cada quiz', () => {
    for (const quiz of quizzes) {
      const positions = new Set(
        quiz.questions.map(
          (question) => question.options.find((option) => option.is_correct === true)?.id
        )
      );
      expect(positions.size, quiz.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('cada pregunta lleva una explanation no vacía', () => {
    for (const quiz of quizzes) {
      for (const question of quiz.questions) {
        expect(
          question.explanation?.trim().length ?? 0,
          `${quiz.slug} ${question.id}`
        ).toBeGreaterThan(0);
      }
    }
  });

  it('los metadatos respetan los límites editoriales', () => {
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
