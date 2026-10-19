import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026ap.json');

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

// The five science topics as (en slug, es slug, quiz_type) pairs.
// The solar system pair covers moons, the Sun and scale — the planets-101
// quiz already exists as en-solar-system-planets-trivia (batch 2026k).
// The inventions pair covers pre-1900 breakthroughs — the inventors-101
// quiz already exists as en-inventions-trivia (batch 2026c, technology).
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-solar-system-moons-trivia', 'es-trivia-lunas-del-sistema-solar', 'trivia'],
  ['en-great-inventions-trivia', 'es-trivia-grandes-inventos', 'trivia'],
  ['en-brain-and-senses-trivia', 'es-trivia-cerebro-y-sentidos', 'trivia'],
  ['en-which-planet-are-you', 'es-que-planeta-eres', 'personality'],
  ['en-which-scientist-are-you', 'es-que-cientifico-serias', 'personality'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026ap', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene exactamente los 5 pares es/en por tema, todos en science', () => {
    expect(quizzes).toHaveLength(10);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug, quizType] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe('science');
      expect(es!.category).toBe('science');
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

  it('cada trivia tiene 8 preguntas, 4 opciones, una sola correcta y explanation', () => {
    const trivias = quizzes.filter((quiz) => quiz.quiz_type === 'trivia');
    expect(trivias).toHaveLength(6);
    for (const quiz of trivias) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(120);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(160);
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeGreaterThanOrEqual(2);
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeLessThanOrEqual(6);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
        expect(
          question.explanation && question.explanation.length > 20,
          `${quiz.slug} ${question.id} sin explanation`
        ).toBe(true);
      }
    }
  });

  it('cada personalidad tiene 6-8 preguntas y 4-6 resultados con tags válidos', () => {
    const personality = quizzes.filter((quiz) => quiz.quiz_type === 'personality');
    expect(personality).toHaveLength(4);
    for (const quiz of personality) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      expect(quiz.results?.length ?? 0, quiz.slug).toBeGreaterThanOrEqual(4);
      expect(quiz.results?.length ?? 0, quiz.slug).toBeLessThanOrEqual(6);
      const resultTags = new Set((quiz.results ?? []).map((result) => result.personality_tag));
      for (const question of quiz.questions) {
        for (const option of question.options) {
          expect(option.is_correct, `${quiz.slug} ${question.id} ${option.id}`).toBeUndefined();
          const tags = option.personality_tags ?? [];
          expect(tags.length, `${quiz.slug} ${question.id} ${option.id}`).toBeGreaterThanOrEqual(1);
          for (const tag of tags) {
            expect(resultTags.has(tag), `${quiz.slug} ${question.id} tag desconocido: ${tag}`).toBe(
              true
            );
          }
        }
      }
    }
  });

  it('el texto en español no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((quiz) => quiz.language === 'es')) {
      const text = [
        quiz.title,
        quiz.description,
        ...(quiz.results ?? []).flatMap((result) => [result.title]),
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
