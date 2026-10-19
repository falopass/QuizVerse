import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-personality.json');

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
  ['en-what-kind-of-traveler-are-you', 'es-que-tipo-de-viajero-eres', 'lifestyle'],
  ['en-what-kind-of-friend-are-you', 'es-que-tipo-de-amigo-eres', 'relationships'],
  ['en-what-is-your-work-style', 'es-cual-es-tu-estilo-de-trabajo', 'lifestyle'],
  ['en-what-is-your-learning-style', 'es-cual-es-tu-estilo-de-aprendizaje', 'culture'],
  ['en-what-is-your-ideal-weekend', 'es-cual-es-tu-fin-de-semana-ideal', 'lifestyle'],
];

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

describe('editorial-seed-personality', () => {
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

  it('cada quiz tiene >=6 preguntas con 4 opciones taggeadas y descripción >=40', () => {
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

  it('cada tag usado tiene resultado y cada resultado es alcanzable', () => {
    for (const quiz of quizzes) {
      const resultTags = new Set((quiz.results ?? []).map((result) => result.personality_tag));
      const usedTags = new Set(
        quiz.questions.flatMap((question) =>
          question.options.flatMap((option) => option.personality_tags ?? [])
        )
      );
      expect(quiz.results?.length, quiz.slug).toBeGreaterThanOrEqual(2);
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
});
