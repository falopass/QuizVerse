import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026ct.json');
const SQL_PATH = join(__dirname, '..', 'supabase', 'seed', 'editorial-seed-2026ct.sql');

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

// The eight anime/manga franchises as (en slug, es slug, result count) pairs.
const EXPECTED_PAIRS: Array<[string, string, number]> = [
  ['en-which-dragon-ball-character-are-you', 'es-que-personaje-de-dragon-ball-eres', 6],
  ['en-which-my-hero-academia-character-are-you', 'es-que-personaje-de-my-hero-academia-eres', 6],
  ['en-which-death-note-character-are-you', 'es-que-personaje-de-death-note-eres', 6],
  [
    'en-which-fullmetal-alchemist-character-are-you',
    'es-que-personaje-de-fullmetal-alchemist-eres',
    6,
  ],
  ['en-which-bleach-character-are-you', 'es-que-personaje-de-bleach-eres', 6],
  ['en-which-haikyu-character-are-you', 'es-que-personaje-de-haikyu-eres', 6],
  ['en-which-tokyo-revengers-character-are-you', 'es-que-personaje-de-tokyo-revengers-eres', 6],
  ['en-which-hunter-x-hunter-character-are-you', 'es-que-personaje-de-hunter-x-hunter-eres', 5],
];

const THEMES = new Set(['fire', 'ice', 'stars', 'ocean', 'forest', 'mystic']);

const VOSEO =
  /\b(vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)\b/iu;

const quizzes = (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as { quizzes: SeedQuiz[] }).quizzes;

function resultTags(quiz: SeedQuiz): Set<string> {
  return new Set((quiz.results ?? []).map((result) => result.personality_tag as string));
}

function usedTags(quiz: SeedQuiz): Set<string> {
  return new Set(
    quiz.questions.flatMap((question) =>
      question.options.flatMap((option) => option.personality_tags ?? [])
    )
  );
}

describe('editorial-seed-2026ct', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    expect(stdout).toContain('"anime-manga":16');
  });

  it('el SQL versionado está sincronizado con el JSON del lote', () => {
    // Si se edita el JSON sin regenerar el SQL, el importador aplicaría otra cosa.
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const versioned = readFileSync(SQL_PATH, 'utf8');
    // stdout = SQL + línea "Validated: {...}"; la sincronía es exacta.
    const emitted = stdout.replace(/Validated: \{.*\}\n?$/, '');
    expect(emitted).toBe(versioned);
  });

  it('tiene exactamente los 8 pares es/en de anime-manga', () => {
    expect(quizzes).toHaveLength(16);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe('anime-manga');
      expect(es!.category).toBe('anime-manga');
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

  it('cada slug lleva el prefijo de su idioma y los títulos siguen el formato', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
    }
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = quizzes.find((quiz) => quiz.slug === enSlug)!;
      const es = quizzes.find((quiz) => quiz.slug === esSlug)!;
      expect(en.title, enSlug).toMatch(/^Which .+ Character Are You\?$/);
      expect(es.title, esSlug).toMatch(/^¿Qué personaje de .+ eres\?$/);
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

  it('cada quiz tiene los resultados esperados con tags únicos y tema conocido', () => {
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug, resultCount] of EXPECTED_PAIRS) {
      for (const slug of [enSlug, esSlug]) {
        const quiz = bySlug.get(slug)!;
        expect(quiz.results, slug).toHaveLength(resultCount);
        const tags = (quiz.results ?? []).map((result) => result.personality_tag);
        expect(new Set(tags).size, slug).toBe(resultCount);
        for (const result of quiz.results ?? []) {
          expect(THEMES.has(result.background_theme ?? ''), `${slug} ${result.id}`).toBe(true);
          expect(result.description.length, `${slug} ${result.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('cada personality_tag de opción existe en results y todo resultado es alcanzable', () => {
    for (const quiz of quizzes) {
      const results = resultTags(quiz);
      const used = usedTags(quiz);
      for (const tag of used) {
        expect(results.has(tag), `${quiz.slug}: opción usa tag sin resultado "${tag}"`).toBe(true);
      }
      for (const tag of results) {
        expect(used.has(tag), `${quiz.slug}: resultado inalcanzable "${tag}"`).toBe(true);
      }
    }
  });

  it('los pares en/es comparten los mismos tags de resultado y de opción', () => {
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug)!;
      const es = bySlug.get(esSlug)!;
      expect([...resultTags(en)].sort(), `${enSlug} vs ${esSlug}`).toEqual(
        [...resultTags(es)].sort()
      );
      expect([...usedTags(en)].sort(), `${enSlug} vs ${esSlug}`).toEqual([...usedTags(es)].sort());
    }
  });

  it('título y descripción cumplen los rangos editoriales', () => {
    for (const quiz of quizzes) {
      expect(quiz.title.length, `${quiz.slug} title`).toBeGreaterThanOrEqual(30);
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
