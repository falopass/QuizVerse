import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026e.json');

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

// The five evergreen topics as (en slug, es slug, topic category) pairs.
const EXPECTED_PAIRS: Array<[string, string, string]> = [
  ['en-what-animal-are-you', 'es-que-animal-eres', 'lifestyle'],
  ['en-what-career-suits-you', 'es-que-carrera-es-para-ti', 'lifestyle'],
  ['en-your-intelligence-type', 'es-cual-es-tu-tipo-de-inteligencia', 'culture'],
  ['en-your-mental-age', 'es-cual-es-tu-edad-mental', 'culture'],
  ['en-what-natural-element-are-you', 'es-que-elemento-natural-eres', 'lifestyle'],
];

// Rioplatense voseo: pronoun, common present forms and imperatives.
// \b no sirve aquí: en JS las tildes no son caracteres de palabra y "esperá"
// matchearía dentro de "esperándome".
const VOSEO =
  /(?<![a-záéíóúüñ])(?:vos|tenés|querés|podés|sabés|sentís|elegís|hacés|decís|andás|vivís|pensás|mirá|vení|decí|andá|hacé|poné|tomá|dejá|pasá|salí|entrá|esperá|seguí|volvé|dormí|comé|usá|buscá|probá|fijate|contame)(?![a-záéíóúüñ])/i;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

function quizText(quiz: SeedQuiz): string {
  return [
    quiz.title,
    quiz.description,
    ...quiz.questions.flatMap((question) => [
      question.question,
      ...question.options.map((option) => option.text),
    ]),
    ...(quiz.results ?? []).flatMap((result) => [result.title, result.description]),
  ].join(' ');
}

describe('editorial-seed-2026e', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    // Personality quizzes without results never resolve an outcome; the
    // emitter must write them, not null.
    expect(stdout).toContain('"personality_tag":"');
  });

  it('tiene exactamente los 5 pares es/en por tema', () => {
    expect(quizzes).toHaveLength(10);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    expect(bySlug.size, 'slugs duplicados').toBe(10);
    for (const [enSlug, esSlug, category] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(enSlug.startsWith('en-')).toBe(true);
      expect(esSlug.startsWith('es-')).toBe(true);
      expect(en!.category).toBe(category);
      expect(es!.category).toBe(category);
      // Sin entrada en el mapa de locales, el switcher y los hreflang caen a home.
      expect(getEquivalentQuizSlug(enSlug, 'es'), enSlug).toBe(esSlug);
      expect(getEquivalentQuizSlug(esSlug, 'en'), esSlug).toBe(enSlug);
    }
  });

  it('los 10 son personality con categoría de tema (nunca "personality")', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('personality');
      expect(quiz.category, quiz.slug).not.toBe('personality');
      expect(['lifestyle', 'relationships', 'culture'], quiz.slug).toContain(quiz.category);
    }
  });

  it('cada quiz tiene 6-8 preguntas con 4 opciones taggeadas y descripción >=40', () => {
    for (const quiz of quizzes) {
      expect(quiz.description.length, quiz.slug).toBeGreaterThanOrEqual(40);
      expect(quiz.questions.length, quiz.slug).toBeGreaterThanOrEqual(6);
      expect(quiz.questions.length, quiz.slug).toBeLessThanOrEqual(8);
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        for (const option of question.options) {
          expect(
            option.personality_tags?.length,
            `${quiz.slug} ${question.id}/${option.id}`
          ).toBeGreaterThanOrEqual(1);
          expect(
            option.personality_tags!.length,
            `${quiz.slug} ${question.id}/${option.id}`
          ).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('cada quiz tiene 4 resultados cuyos tags cubren exactamente los de las opciones', () => {
    for (const quiz of quizzes) {
      expect(quiz.results, quiz.slug).toHaveLength(4);
      const resultTags = new Set((quiz.results ?? []).map((result) => result.personality_tag));
      const usedTags = new Set(
        quiz.questions.flatMap((question) =>
          question.options.flatMap((option) => option.personality_tags ?? [])
        )
      );
      expect(resultTags, `${quiz.slug}: resultados y opciones usan tags distintos`).toEqual(
        usedTags
      );
      for (const result of quiz.results ?? []) {
        expect(result.id, `${quiz.slug}: resultado sin id`).toBeTruthy();
        expect(result.title, `${quiz.slug}: resultado sin título`).toBeTruthy();
        expect(
          result.description.length,
          `${quiz.slug} ${result.id}: descripción corta`
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('el español es neutro, sin voseo', () => {
    for (const quiz of quizzes.filter((q) => q.language === 'es')) {
      const match = quizText(quiz).match(VOSEO);
      expect(match, `${quiz.slug}: voseo "${match?.[0]}"`).toBeNull();
    }
  });
});
