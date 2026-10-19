import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026am.json');

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

// The five mythology and ancient-world topics as (en slug, es slug, category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-olympian-gods-trivia', 'es-trivia-dioses-del-olimpo', 'history'],
  ['en-norse-mythology-ragnarok-trivia', 'es-trivia-mitologia-nordica-ragnarok', 'history'],
  ['en-egyptian-gods-trivia', 'es-trivia-dioses-egipcios', 'history'],
  ['en-which-greek-god-are-you', 'es-que-dios-griego-eres', 'culture'],
  ['en-which-mythological-creature-are-you', 'es-que-criatura-mitologica-eres', 'culture'],
];

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;
const trivia = quizzes.filter((quiz) => quiz.quiz_type === 'trivia');
const personality = quizzes.filter((quiz) => quiz.quiz_type === 'personality');

describe('editorial-seed-2026am', () => {
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

  it('descriptions stay inside the 120-160 character SEO window', () => {
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(120);
      expect(quiz.description.length, quiz.slug).toBeLessThanOrEqual(160);
    }
  });

  it('cada trivia tiene 8 preguntas, 2-6 opciones y una sola correcta', () => {
    for (const quiz of trivia) {
      expect(quiz.questions.length, quiz.slug).toBe(8);
      for (const question of quiz.questions) {
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeGreaterThanOrEqual(2);
        expect(question.options.length, `${quiz.slug} ${question.id}`).toBeLessThanOrEqual(6);
        const correct = question.options.filter((option) => option.is_correct === true);
        expect(correct, `${quiz.slug} ${question.id}`).toHaveLength(1);
      }
    }
  });

  it('toda pregunta de trivia trae una explicación no vacía', () => {
    for (const quiz of trivia) {
      for (const question of quiz.questions) {
        expect(
          typeof question.explanation === 'string' && question.explanation.trim().length > 0,
          `${quiz.slug} ${question.id}`
        ).toBe(true);
      }
    }
  });

  it('los quizzes de personalidad tienen 6-8 preguntas, 4-6 resultados y tags válidos', () => {
    for (const quiz of personality) {
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      const tags = new Set((quiz.results ?? []).map((result) => result.personality_tag));
      expect(tags.size, `${quiz.slug} results`).toBeGreaterThanOrEqual(4);
      expect(tags.size, `${quiz.slug} results`).toBeLessThanOrEqual(6);
      for (const question of quiz.questions) {
        for (const option of question.options) {
          expect(option.is_correct, `${quiz.slug} ${question.id}`).toBeUndefined();
          const optionTags = option.personality_tags ?? [];
          expect(
            optionTags.length,
            `${quiz.slug} ${question.id} ${option.id}`
          ).toBeGreaterThanOrEqual(1);
          for (const tag of optionTags) {
            expect(tags.has(tag), `${quiz.slug} ${question.id} ${option.id}: ${tag}`).toBe(true);
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
        ...(quiz.results ?? []).flatMap((result) => [result.title, result.description ?? '']),
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
