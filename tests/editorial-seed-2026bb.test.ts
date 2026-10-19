import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026bb.json');

interface SeedOption {
  id: string;
  text: string;
  personality_tags?: string[];
}

interface SeedQuestion {
  id: string;
  question: string;
  options: SeedOption[];
}

interface SeedResult {
  id: string;
  title: string;
  description: string;
  personality_tag?: string;
  background_theme?: string;
}

interface SeedQuiz {
  slug: string;
  title: string;
  description: string;
  quiz_type: string;
  language: string;
  category: string;
  tags: string[];
  results?: SeedResult[];
  questions: SeedQuestion[];
}

// The five relationships topics as (en slug, es slug) pairs.
const EXPECTED_PAIRS: Array<[string, string]> = [
  ['en-love-language-test', 'es-test-lenguaje-del-amor'],
  ['en-communication-style-test', 'es-test-estilo-de-comunicacion'],
  ['en-attachment-style-test', 'es-test-estilo-de-apego'],
  ['en-family-role-test', 'es-test-rol-en-la-familia'],
  ['en-what-kind-of-partner-are-you', 'es-que-tipo-de-pareja-eres'],
];

const THEMES = new Set(['forest', 'fire', 'stars', 'ice']);

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-2026bb', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
  });

  it('tiene exactamente los 5 pares es/en de relationships', () => {
    expect(quizzes).toHaveLength(10);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe('relationships');
      expect(es!.category).toBe('relationships');
    }
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(5);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(5);
  });

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('los 10 son personality con 8 preguntas de 4 opciones taggeadas', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('personality');
      expect(quiz.questions, quiz.slug).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        for (const option of question.options) {
          expect(
            option.personality_tags?.length,
            `${quiz.slug} ${question.id}/${option.id}`
          ).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('cada quiz tiene 4 resultados con tags únicos y tema de fondo conocido', () => {
    for (const quiz of quizzes) {
      expect(quiz.results, quiz.slug).toHaveLength(4);
      const tags = (quiz.results ?? []).map((result) => result.personality_tag);
      expect(new Set(tags).size, quiz.slug).toBe(4);
      for (const result of quiz.results ?? []) {
        expect(THEMES.has(result.background_theme ?? ''), `${quiz.slug} ${result.id}`).toBe(true);
        expect(result.description.length, `${quiz.slug} ${result.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('cada tag de resultado aparece al menos una vez en las opciones de cada pregunta', () => {
    for (const quiz of quizzes) {
      const resultTags = new Set(
        (quiz.results ?? []).map((result) => result.personality_tag as string)
      );
      for (const question of quiz.questions) {
        const used = new Set(
          question.options.flatMap((option) => option.personality_tags ?? [])
        );
        for (const tag of resultTags) {
          expect(
            used.has(tag),
            `${quiz.slug} ${question.id}: falta opción para "${tag}"`
          ).toBe(true);
        }
        for (const tag of used) {
          expect(
            resultTags.has(tag),
            `${quiz.slug} ${question.id}: opción usa tag sin resultado "${tag}"`
          ).toBe(true);
        }
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

  it('el texto en español no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((quiz) => quiz.language === 'es')) {
      const text = [
        quiz.title,
        quiz.description,
        ...(quiz.results ?? []).flatMap((result) => [result.title, result.description]),
        ...quiz.questions.flatMap((question) => [
          question.question,
          ...question.options.map((option) => option.text),
        ]),
      ].join(' ');
      expect(VOSEO.test(text), `${quiz.slug}: ${text.match(VOSEO)?.[0]}`).toBe(false);
    }
  });
});
