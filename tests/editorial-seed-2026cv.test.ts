import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { calculatePersonalityResult } from '@/lib/quiz/engine';
import type { PersonalityResult } from '@/types/quiz';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026cv.json');

interface SeedOption {
  id: string;
  text: string;
  personality_tags?: string[];
}

interface SeedQuestion {
  id: string;
  question: string;
  options: SeedOption[];
  explanation?: string | null;
  time_limit_seconds?: number;
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
  difficulty: string;
  language: string;
  category: string;
  tags: string[];
  estimated_minutes: number;
  results?: SeedResult[];
  questions: SeedQuestion[];
}

// The eight games as (en slug, es slug) pairs; every quiz has 6 results.
const EXPECTED_PAIRS: Array<[string, string]> = [
  ['en-which-league-of-legends-champion-are-you', 'es-que-campeon-de-league-of-legends-eres'],
  ['en-which-among-us-role-are-you', 'es-que-rol-de-among-us-eres'],
  ['en-which-animal-crossing-villager-are-you', 'es-que-vecino-de-animal-crossing-eres'],
  ['en-which-undertale-character-are-you', 'es-que-personaje-de-undertale-eres'],
  ['en-which-hollow-knight-character-are-you', 'es-que-personaje-de-hollow-knight-eres'],
  ['en-which-the-witcher-3-character-are-you', 'es-que-personaje-de-the-witcher-3-eres'],
  ['en-which-overwatch-hero-are-you', 'es-que-heroe-de-overwatch-eres'],
  ['en-which-genshin-impact-character-are-you', 'es-que-personaje-de-genshin-impact-eres'],
];

const THEMES = new Set(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']);

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

function resultTags(quiz: SeedQuiz): Set<string> {
  return new Set((quiz.results ?? []).map((result) => result.personality_tag as string));
}

function tagCounts(quiz: SeedQuiz): Map<string, number> {
  const counts = new Map<string, number>();
  for (const question of quiz.questions) {
    for (const option of question.options) {
      for (const tag of option.personality_tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return counts;
}

describe('editorial-seed-2026cv', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    expect(stdout).toContain('"gaming":16');
  });

  it('tiene exactamente los 8 pares es/en de gaming', () => {
    expect(quizzes).toHaveLength(16);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe('gaming');
      expect(es!.category).toBe('gaming');
    }
    expect(quizzes.filter((quiz) => quiz.language === 'en')).toHaveLength(8);
    expect(quizzes.filter((quiz) => quiz.language === 'es')).toHaveLength(8);
  });

  it('cada par resuelve su equivalente en el mapa de locales', () => {
    // Sin esta entrada el switcher de idioma y los hreflang caen a la categoría.
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

  it('los 16 son personality easy de 7 preguntas, 4 opciones taggeadas y 30s', () => {
    for (const quiz of quizzes) {
      expect(quiz.quiz_type, quiz.slug).toBe('personality');
      expect(quiz.difficulty, quiz.slug).toBe('easy');
      expect(quiz.estimated_minutes, quiz.slug).toBe(3);
      expect(quiz.questions, quiz.slug).toHaveLength(7);
      for (const question of quiz.questions) {
        expect(question.options, `${quiz.slug} ${question.id}`).toHaveLength(4);
        expect(question.explanation, `${quiz.slug} ${question.id}`).toBeNull();
        expect(question.time_limit_seconds, `${quiz.slug} ${question.id}`).toBe(30);
        for (const option of question.options) {
          expect(
            option.personality_tags?.length,
            `${quiz.slug} ${question.id}/${option.id}`
          ).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('cada quiz tiene 6 resultados con tags únicos y tema conocido', () => {
    for (const quiz of quizzes) {
      expect(quiz.results, quiz.slug).toHaveLength(6);
      const tags = (quiz.results ?? []).map((result) => result.personality_tag);
      expect(new Set(tags).size, quiz.slug).toBe(6);
      for (const result of quiz.results ?? []) {
        expect(THEMES.has(result.background_theme ?? ''), `${quiz.slug} ${result.id}`).toBe(true);
        expect(result.description.length, `${quiz.slug} ${result.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('cada personality_tag de opción existe en results y todo resultado es alcanzable', () => {
    for (const quiz of quizzes) {
      const results = resultTags(quiz);
      const counts = tagCounts(quiz);
      for (const tag of counts.keys()) {
        expect(results.has(tag), `${quiz.slug}: opción usa tag sin resultado "${tag}"`).toBe(true);
      }
      // Ningún resultado domina ni queda inalcanzable: 4-5 opciones por tag.
      for (const tag of results) {
        const count = counts.get(tag) ?? 0;
        expect(count, `${quiz.slug}: resultado inalcanzable "${tag}"`).toBeGreaterThanOrEqual(3);
        expect(count, `${quiz.slug}: tag dominante "${tag}"`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('enumerando las 4^7 respuestas, todo resultado cae cerca del reparto uniforme', () => {
    // Misma regla que producción: calculatePersonalityResult gana el tag más
    // frecuente y, en empate, conserva el primero visto en orden de respuesta.
    // Las preguntas están ordenadas para que los dos tags con 4 opciones salgan
    // en q1 y el desempate compense su menor cuenta (~15-20 % c/u; uniforme 16.7 %).
    const combos: number[][] = [];
    for (let i = 0; i < 4 ** 7; i++) {
      const combo = [];
      for (let n = i, q = 0; q < 7; q++, n = Math.floor(n / 4)) combo.push(n % 4);
      combos.push(combo);
    }
    for (const quiz of quizzes) {
      const results = (quiz.results ?? []).map(
        (result) =>
          ({
            ...result,
            background_theme: result.background_theme as PersonalityResult['background_theme'],
          }) satisfies PersonalityResult
      );
      const freq = new Map<string, number>();
      for (const combo of combos) {
        const tags = combo.map(
          (optionIndex, questionIndex) =>
            quiz.questions[questionIndex].options[optionIndex].personality_tags![0]
        );
        const winner = calculatePersonalityResult(tags, results);
        freq.set(winner!.id, (freq.get(winner!.id) ?? 0) + 1);
      }
      expect(freq.size, quiz.slug).toBe(6);
      for (const [id, count] of freq) {
        const share = count / combos.length;
        expect(share, `${quiz.slug} ${id} inalcanzable o raro`).toBeGreaterThanOrEqual(0.13);
        expect(share, `${quiz.slug} ${id} dominante`).toBeLessThanOrEqual(0.21);
      }
    }
  });

  it('los pares en/es comparten los mismos tags de resultado y conteos por tag', () => {
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug)!;
      const es = bySlug.get(esSlug)!;
      expect([...resultTags(en)].sort(), `${enSlug} vs ${esSlug}`).toEqual(
        [...resultTags(es)].sort()
      );
      expect(Object.fromEntries([...tagCounts(en)].sort()), enSlug).toEqual(
        Object.fromEntries([...tagCounts(es)].sort())
      );
    }
  });

  it('título, descripción y tags cumplen los rangos editoriales', () => {
    for (const quiz of quizzes) {
      expect(quiz.title.length, `${quiz.slug} title`).toBeGreaterThanOrEqual(24);
      expect(quiz.title.length, `${quiz.slug} title`).toBeLessThanOrEqual(65);
      expect(quiz.description.length, `${quiz.slug} description`).toBeGreaterThanOrEqual(80);
      expect(quiz.description.length, `${quiz.slug} description`).toBeLessThanOrEqual(158);
      expect(quiz.tags.length, quiz.slug).toBeGreaterThanOrEqual(3);
      expect(quiz.tags.length, quiz.slug).toBeLessThanOrEqual(5);
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
