import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026al.json');

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
  personality_tag: string;
  background_theme?: string;
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

// The five topics as (en slug, es slug, category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-how-good-a-roommate-are-you', 'es-que-tan-buen-companero-de-piso-eres', 'relationships'],
  ['en-how-healthy-are-your-digital-habits', 'es-que-tan-saludables-son-tus-habitos-digitales', 'technology'],
  ['en-everyday-technology-trivia', 'es-trivia-tecnologia-cotidiana', 'technology'],
  ['en-world-literature-trivia', 'es-trivia-literatura-universal', 'literature'],
  ['en-2000s-pop-culture-trivia', 'es-trivia-cultura-pop-de-los-2000', 'pop-culture'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;
const trivia = quizzes.filter((quiz) => quiz.quiz_type === 'trivia');
const personality = quizzes.filter((quiz) => quiz.quiz_type === 'personality');

describe('editorial-seed-2026al', () => {
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

  it('las descripciones miden entre 120 y 160 caracteres', () => {
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(120);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(160);
    }
  });

  it('la trivia tiene 8 preguntas, 2-6 opciones, una sola correcta y explanation', () => {
    expect(trivia).toHaveLength(6);
    for (const quiz of trivia) {
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeGreaterThanOrEqual(2);
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeLessThanOrEqual(6);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
        expect(question.explanation, `${quiz.slug} ${question.id}`).toBeTruthy();
      }
    }
  });

  it('la personalidad tiene 6-8 preguntas con personality_tags y 4-6 resultados', () => {
    expect(personality).toHaveLength(4);
    for (const quiz of personality) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      expect(quiz.results, quiz.slug).toBeDefined();
      expect(quiz.results!.length, quiz.slug).toBeGreaterThanOrEqual(4);
      expect(quiz.results!.length, quiz.slug).toBeLessThanOrEqual(6);
      const resultTags = new Set(quiz.results!.map((result) => result.personality_tag));
      for (const result of quiz.results!) {
        expect(result.personality_tag, `${quiz.slug} ${result.id}`).toBeTruthy();
        expect(result.description, `${quiz.slug} ${result.id}`).toBeTruthy();
      }
      for (const question of quiz.questions) {
        for (const option of question.options) {
          expect(option.personality_tags, `${quiz.slug} ${question.id} ${option.id}`).toBeDefined();
          for (const tag of option.personality_tags!) {
            expect(resultTags.has(tag), `${quiz.slug} ${question.id} ${option.id}: ${tag}`).toBe(
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
