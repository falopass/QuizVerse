import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026be.json');

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

// The five human body and health topics as (en slug, es slug, category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-human-digestive-system-trivia', 'es-trivia-sistema-digestivo', 'science'],
  ['en-heart-and-circulation-trivia', 'es-trivia-corazon-y-circulacion', 'science'],
  ['en-bones-and-muscles-trivia', 'es-trivia-huesos-y-musculos', 'science'],
  ['en-human-brain-trivia', 'es-trivia-cerebro', 'science'],
  ['en-immune-system-trivia', 'es-trivia-sistema-inmune', 'science'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026be', () => {
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

  it('cada quiz es trivia media de 3 minutos con 6-8 preguntas, 4 opciones, una correcta y explicación', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('trivia');
      expect(quiz.difficulty, quiz.slug).toBe('medium');
      expect(quiz.estimated_minutes, quiz.slug).toBe(3);
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
        expect(question.explanation?.length, `${quiz.slug} ${question.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('título, descripción y etiquetas cumplen los rangos editoriales', () => {
    for (const quiz of quizzes) {
      expect(quiz.title.length, `${quiz.slug} title`).toBeGreaterThanOrEqual(30);
      expect(quiz.title.length, `${quiz.slug} title`).toBeLessThanOrEqual(65);
      expect(quiz.description.length, `${quiz.slug} description`).toBeGreaterThanOrEqual(80);
      expect(quiz.description.length, `${quiz.slug} description`).toBeLessThanOrEqual(158);
      expect(quiz.tags.length, `${quiz.slug} tags`).toBeGreaterThanOrEqual(3);
      expect(quiz.tags.length, `${quiz.slug} tags`).toBeLessThanOrEqual(5);
    }
  });

  it('los pares es/en son el mismo cuestionario traducido', () => {
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug)!;
      const es = bySlug.get(esSlug)!;
      expect(es.questions, esSlug).toHaveLength(en.questions.length);
      en.questions.forEach((question, index) => {
        const mirror = es.questions[index];
        expect(mirror.id, `${esSlug} q${index + 1}`).toBe(question.id);
        expect(
          mirror.options.map((option) => option.id),
          `${esSlug} ${question.id} opciones`
        ).toEqual(question.options.map((option) => option.id));
        expect(
          mirror.options.findIndex((option) => option.is_correct === true),
          `${esSlug} ${question.id} correcta`
        ).toBe(question.options.findIndex((option) => option.is_correct === true));
      });
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
