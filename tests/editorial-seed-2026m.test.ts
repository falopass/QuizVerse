import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EMITTER = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026m.json');

// El lote va en español neutro: sin voseo rioplatense ni segunda persona plural ibérica.
const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/i;

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
  results?: SeedResult[];
  questions: SeedQuestion[];
}

// Los cinco temas del lote 2026m como (slug en, slug es, categoría).
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-halloween-trivia', 'es-trivia-halloween', 'culture'],
  ['en-horror-movies-trivia', 'es-trivia-peliculas-de-terror', 'movies-tv'],
  ['en-day-of-the-dead-trivia', 'es-trivia-dia-de-muertos', 'culture'],
  ['en-monsters-and-urban-legends-trivia', 'es-trivia-monstruos-y-leyendas', 'pop-culture'],
  ['en-which-halloween-creature-are-you', 'es-que-criatura-de-halloween-eres', 'lifestyle'],
];

const TRIVIA_SLUGS = new Set(
  EXPECTED_PAIRS.slice(0, 4).flatMap(([enSlug, esSlug]) => [enSlug, esSlug])
);

const quizzes = (JSON.parse(readFileSync(SEED, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

function collectStrings(value: unknown, strings: string[] = []): string[] {
  if (typeof value === 'string') {
    strings.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, strings);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, strings);
  }
  return strings;
}

describe('editorial-seed-2026m', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [EMITTER, '--input', SEED], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    expect(stdout).toContain('Validated:');
  });

  it('tiene exactamente los 5 pares en/es pedidos', () => {
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
  });

  it('cada slug lleva el prefijo de su idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
  });

  it('los trivia son 6-8 preguntas, 4 opciones y una sola correcta', () => {
    for (const quiz of quizzes.filter((item) => item.quiz_type === 'trivia')) {
      expect(TRIVIA_SLUGS.has(quiz.slug), quiz.slug).toBe(true);
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        const where = `${quiz.slug} ${question.id}`;
        expect(question.options, where).toHaveLength(4);
        expect(
          question.options.filter((option) => option.is_correct === true),
          where
        ).toHaveLength(1);
        expect(new Set(question.options.map((option) => option.id)).size, where).toBe(
          question.options.length
        );
        expect(question.explanation?.length ?? 0, where).toBeGreaterThan(0);
      }
    }
  });

  it('el par de personalidad tiene 5 resultados y tags alcanzables', () => {
    for (const quiz of quizzes.filter((item) => item.quiz_type === 'personality')) {
      expect(quiz.results?.length, quiz.slug).toBe(5);
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      const resultTags = new Set((quiz.results ?? []).map((result) => result.personality_tag));
      const usedTags = new Set(
        quiz.questions.flatMap((question) =>
          question.options.flatMap((option) => option.personality_tags ?? [])
        )
      );
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        for (const option of question.options) {
          const count = option.personality_tags?.length ?? 0;
          expect(count, `${quiz.slug} ${question.id}/${option.id}`).toBeGreaterThanOrEqual(1);
          expect(count, `${quiz.slug} ${question.id}/${option.id}`).toBeLessThanOrEqual(2);
        }
      }
      for (const tag of usedTags) {
        expect(resultTags.has(tag), `${quiz.slug}: opción usa tag sin resultado "${tag}"`).toBe(
          true
        );
      }
      for (const tag of resultTags) {
        expect(usedTags.has(tag!), `${quiz.slug}: resultado inalcanzable "${tag}"`).toBe(true);
      }
    }
  });

  it('el español del lote no usa voseo ni formas rioplatenses', () => {
    for (const quiz of quizzes.filter((item) => item.language === 'es')) {
      for (const text of collectStrings(quiz)) {
        expect(VOSEO.test(text), `${quiz.slug}: "${text}"`).toBe(false);
      }
    }
  });
});
