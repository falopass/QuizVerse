import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026ak.json');

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
  title?: string;
  description?: string;
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

// The five es/en pairs as (trivia slug, personality slug, trivia category, personality category).
// Each pair shares one theme but mixes formats, so the batch lands 5 trivia and 5 personality
// quizzes and covers the six thinnest categories in one pass.
const EXPECTED_PAIRS: Array<[string, string, string, string]> = [
  ['en-world-spices-trivia', 'es-que-especie-eres', 'food-drink', 'food-drink'],
  ['es-trivia-tabla-periodica', 'en-which-element-are-you', 'science', 'science'],
  ['en-animal-superpowers-trivia', 'es-que-superpoder-animal-tendrias', 'animals', 'animals'],
  [
    'es-trivia-lugares-extremos-del-mundo',
    'en-which-extreme-place-are-you',
    'geography',
    'geography',
  ],
  ['en-ancient-sports-trivia', 'es-que-deporte-de-la-antiguedad-eres', 'history', 'sports'],
];

const THIN_CATEGORIES = ['food-drink', 'science', 'animals', 'geography', 'history', 'sports'];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026ak', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene exactamente los 5 pares es/en por tema y cubre las seis categorías flacas', () => {
    expect(quizzes).toHaveLength(10);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [triviaSlug, personalitySlug, triviaCat, personalityCat] of EXPECTED_PAIRS) {
      const trivia = bySlug.get(triviaSlug);
      const personality = bySlug.get(personalitySlug);
      expect(trivia, `falta ${triviaSlug}`).toBeDefined();
      expect(personality, `falta ${personalitySlug}`).toBeDefined();
      expect(trivia!.quiz_type).toBe('trivia');
      expect(personality!.quiz_type).toBe('personality');
      expect(trivia!.category).toBe(triviaCat);
      expect(personality!.category).toBe(personalityCat);
      // Cada par cubre los dos idiomas.
      expect(new Set([trivia!.language, personality!.language])).toEqual(new Set(['en', 'es']));
    }
    for (const category of THIN_CATEGORIES) {
      expect(
        quizzes.some((quiz) => quiz.category === category),
        `ningún quiz en ${category}`
      ).toBe(true);
    }
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.quiz_type === 'trivia')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.quiz_type === 'personality')).toHaveLength(5);
  });

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('cada trivia tiene 8 preguntas, 2-6 opciones, una sola correcta y explanation', () => {
    for (const quiz of quizzes.filter((item) => item.quiz_type === 'trivia')) {
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

  it('cada personalidad tiene 6-8 preguntas con tags y 4-6 resultados válidos', () => {
    for (const quiz of quizzes.filter((item) => item.quiz_type === 'personality')) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      const resultTags = new Set((quiz.results ?? []).map((result) => result.personality_tag));
      expect(quiz.results!.length, quiz.slug).toBeGreaterThanOrEqual(4);
      expect(quiz.results!.length, quiz.slug).toBeLessThanOrEqual(6);
      for (const question of quiz.questions) {
        for (const option of question.options) {
          expect(
            option.personality_tags?.length,
            `${quiz.slug} ${question.id}/${option.id}`
          ).toBeGreaterThanOrEqual(1);
          for (const tag of option.personality_tags ?? []) {
            expect(resultTags.has(tag), `${quiz.slug}: tag ${tag} sin resultado`).toBe(true);
          }
        }
      }
      // Cada resultado debe poder salir: algún option apunta a su tag.
      const usedTags = new Set(
        quiz.questions.flatMap((question) =>
          question.options.flatMap((option) => option.personality_tags ?? [])
        )
      );
      for (const result of quiz.results!) {
        expect(usedTags.has(result.personality_tag!), `${quiz.slug}: resultado inalcanzable`).toBe(
          true
        );
      }
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
        ...(quiz.results ?? []).flatMap((result) => [result.title ?? '', result.description ?? '']),
      ].join(' ');
      expect(VOSEO.test(text), `${quiz.slug}: ${text.match(VOSEO)?.[0]}`).toBe(false);
    }
  });
});
