import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'emit-editorial-seed.mjs');
const SEED_PATH = join(__dirname, '..', 'scripts', 'seed', 'editorial-seed-2026cu.json');
const SQL_PATH = join(__dirname, '..', 'supabase', 'seed', 'editorial-seed-2026cu.sql');

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

// The eight shows as (en slug, es slug, result count) pairs.
const EXPECTED_PAIRS: Array<[string, string, number]> = [
  ['en-which-harry-potter-character-are-you', 'es-que-personaje-de-harry-potter-eres', 6],
  ['en-which-stranger-things-character-are-you', 'es-que-personaje-de-stranger-things-eres', 6],
  ['en-which-wednesday-character-are-you', 'es-que-personaje-de-merlina-eres', 6],
  ['en-which-friends-character-are-you', 'es-que-personaje-de-friends-eres', 6],
  ['en-which-the-office-character-are-you', 'es-que-personaje-de-the-office-eres', 6],
  ['en-which-simpsons-character-are-you', 'es-que-personaje-de-los-simpson-eres', 6],
  ['en-which-star-wars-character-are-you', 'es-que-personaje-de-star-wars-eres', 6],
  ['en-which-breaking-bad-character-are-you', 'es-que-personaje-de-breaking-bad-eres', 6],
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

describe('editorial-seed-2026cu', () => {
  it('el emisor valida el lote y emite el SQL sin errores', () => {
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout).toContain('insert into public.quizzes');
    expect(stdout).toContain('on conflict (slug) do nothing');
    expect(stdout).toContain('"movies-tv":16');
  });

  it('el SQL versionado coincide byte a byte con lo que emite el JSON', () => {
    // Sin esto, un SQL editado a mano o un JSON modificado sin re-emitir
    // pasaría inadvertido hasta el import.
    const stdout = execFileSync('node', [SCRIPT, '--input', SEED_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(stdout.startsWith('-- Editorial seed')).toBe(true);
    const emitted = stdout.slice(0, stdout.indexOf('Validated:'));
    const versioned = readFileSync(SQL_PATH, 'utf8');
    expect(versioned).toBe(emitted);
  });

  it('tiene exactamente los 8 pares es/en de movies-tv', () => {
    expect(quizzes).toHaveLength(16);
    const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));
    for (const [enSlug, esSlug] of EXPECTED_PAIRS) {
      const en = bySlug.get(enSlug);
      const es = bySlug.get(esSlug);
      expect(en, `falta ${enSlug}`).toBeDefined();
      expect(es, `falta ${esSlug}`).toBeDefined();
      expect(en!.language).toBe('en');
      expect(es!.language).toBe('es');
      expect(en!.category).toBe('movies-tv');
      expect(es!.category).toBe('movies-tv');
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

  it('los slugs siguen el formato del lote con prefijo de idioma', () => {
    for (const quiz of quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug).toBe(true);
      const pattern =
        quiz.language === 'en'
          ? /^en-which-[a-z0-9-]+-character-are-you$/
          : /^es-que-personaje-de-[a-z0-9-]+-eres$/;
      expect(quiz.slug, quiz.slug).toMatch(pattern);
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

  it('todo tag de opción existe en results y ningún resultado es inalcanzable', () => {
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

  it('ningún resultado domina por construcción (conteo de tags repartido)', () => {
    for (const quiz of quizzes) {
      const counts = [...tagCounts(quiz).values()];
      const min = Math.min(...counts);
      const max = Math.max(...counts);
      expect(min, `${quiz.slug}: resultado con menos de 3 menciones`).toBeGreaterThanOrEqual(3);
      expect(max - min, `${quiz.slug}: spread de tags ${min}–${max}`).toBeLessThanOrEqual(4);
    }
  });

  it('ningún resultado domina ni queda inalcanzable en las 4^7 partidas posibles', () => {
    // Replica la regla de calculatePersonalityResult: gana el tag más frecuente
    // y el empate lo resuelve la primera aparición en la secuencia elegida.
    function winShares(quiz: SeedQuiz): Map<string, number> {
      const wins = new Map<string, number>();
      const optionTags = quiz.questions.map((question) =>
        question.options.map((option) => option.personality_tags ?? [])
      );
      const total = 4 ** 7;
      for (let pattern = 0; pattern < total; pattern += 1) {
        const counts = new Map<string, number>();
        const order: string[] = [];
        let rest = pattern;
        for (let qi = 0; qi < 7; qi += 1) {
          const pick = rest % 4;
          rest = Math.floor(rest / 4);
          for (const tag of optionTags[qi][pick]) {
            if (!counts.has(tag)) order.push(tag);
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
        const max = Math.max(...counts.values());
        const winner = order.find((tag) => counts.get(tag) === max)!;
        wins.set(winner, (wins.get(winner) ?? 0) + 1);
      }
      return new Map([...wins.entries()].map(([tag, count]) => [tag, count / total]));
    }
    for (const quiz of quizzes) {
      const shares = winShares(quiz);
      for (const result of quiz.results ?? []) {
        const share = shares.get(result.personality_tag ?? '') ?? 0;
        expect(
          share,
          `${quiz.slug}: "${result.personality_tag}" gana ${(share * 100).toFixed(1)}%`
        ).toBeGreaterThanOrEqual(0.1);
        expect(
          share,
          `${quiz.slug}: "${result.personality_tag}" domina con ${(share * 100).toFixed(1)}%`
        ).toBeLessThanOrEqual(0.25);
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
      expect(quiz.title.length, `${quiz.slug} title`).toBeGreaterThanOrEqual(20);
      expect(quiz.title.length, `${quiz.slug} title`).toBeLessThanOrEqual(65);
      expect(quiz.description.length, `${quiz.slug} description`).toBeGreaterThanOrEqual(60);
      expect(quiz.description.length, `${quiz.slug} description`).toBeLessThanOrEqual(158);
      expect(quiz.tags.length, quiz.slug).toBeGreaterThanOrEqual(3);
      expect(quiz.tags.length, quiz.slug).toBeLessThanOrEqual(5);
      for (const result of quiz.results ?? []) {
        expect(result.description.length, `${quiz.slug} ${result.id}`).toBeGreaterThanOrEqual(60);
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
          ...question.options.map((option) => option.text),
        ]),
      ].join(' ');
      expect(VOSEO.test(text), `${quiz.slug}: ${text.match(VOSEO)?.[0]}`).toBe(false);
    }
  });
});
