import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const SEED_SCRIPTS_DIR = join(__dirname, '..', 'scripts', 'seed');
const SEED_SQL_DIR = join(__dirname, '..', 'supabase', 'seed');

const CATEGORIES = new Set([
  'anime-manga',
  'animals',
  'culture',
  'food-drink',
  'gaming',
  'geography',
  'history',
  'literature',
  'lifestyle',
  'movies-tv',
  'music',
  'pop-culture',
  'relationships',
  'science',
  'sports',
  'technology',
]);

// SQL files in supabase/seed that are not emitted from an editorial JSON batch.
const NON_EDITORIAL_SQL = new Set([
  'audit-export.sql',
  'neutral-spanish.sql',
  'quizverse-bootstrap.sql',
]);

interface SeedOption {
  id?: string;
  text?: string;
  is_correct?: boolean;
  personality_tags?: string[];
}

interface SeedQuestion {
  id?: string;
  question?: string;
  options?: SeedOption[];
  explanation?: string;
}

interface SeedQuiz {
  slug?: string;
  title?: string;
  description?: string;
  language?: string;
  category?: string;
  quiz_type?: string;
  questions?: SeedQuestion[];
  results?: unknown[];
}

interface Batch {
  file: string;
  quizzes: SeedQuiz[];
}

function loadJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function quizzesOf(file: string): SeedQuiz[] {
  const parsed = loadJson(file);
  if (Array.isArray(parsed)) return parsed as SeedQuiz[];
  const quizzes = (parsed as { quizzes?: SeedQuiz[] }).quizzes;
  return Array.isArray(quizzes) ? quizzes : [];
}

const jsonBatchFiles = readdirSync(SEED_SCRIPTS_DIR)
  .filter((name) => /^editorial-seed.*\.json$/.test(name))
  .sort();

const batches: Batch[] = jsonBatchFiles.map((name) => ({
  file: join(SEED_SCRIPTS_DIR, name),
  quizzes: quizzesOf(join(SEED_SCRIPTS_DIR, name)),
}));

const allQuizzes = batches.flatMap(({ file, quizzes }) => quizzes.map((quiz) => ({ file, quiz })));

const overrideFiles = readdirSync(SEED_SCRIPTS_DIR)
  .filter((name) => /^quiz-title-overrides.*\.json$/.test(name))
  .sort();

const REQUIRED_FIELDS: Array<keyof SeedQuiz> = [
  'slug',
  'title',
  'description',
  'language',
  'category',
  'quiz_type',
  'questions',
];

describe('inventario de lotes editoriales', () => {
  it('descubre al menos un lote editorial', () => {
    expect(jsonBatchFiles.length).toBeGreaterThanOrEqual(1);
  });

  describe('pares JSON ↔ SQL', () => {
    it.each(jsonBatchFiles)('%s tiene su SQL en supabase/seed', (name) => {
      const sqlName = name.replace(/\.json$/, '.sql');
      expect(
        existsSync(join(SEED_SQL_DIR, sqlName)),
        `${name} no tiene su par ${sqlName} en supabase/seed/`
      ).toBe(true);
    });

    it('no hay SQL editorial sin JSON', () => {
      const orphans = readdirSync(SEED_SQL_DIR)
        .filter((name) => name.endsWith('.sql'))
        .filter((name) => !NON_EDITORIAL_SQL.has(name))
        .filter((name) => !existsSync(join(SEED_SCRIPTS_DIR, name.replace(/\.sql$/, '.json'))));
      expect(orphans).toEqual([]);
    });
  });

  describe('esquema por quiz', () => {
    it.each(batches.map(({ file }) => file))(
      '%s solo contiene quizzes con campos requeridos',
      (file) => {
        for (const quiz of quizzesOf(file)) {
          for (const field of REQUIRED_FIELDS) {
            expect(
              quiz[field],
              `${basename(file)}: quiz ${quiz.slug ?? '(sin slug)'} sin campo "${field}"`
            ).toBeDefined();
          }
        }
      }
    );
  });

  describe('slugs', () => {
    it('son únicos en todo el repo', () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const { file, quiz } of allQuizzes) {
        const slug = quiz.slug ?? '(sin slug)';
        const first = seen.get(slug);
        if (first) duplicates.push(`${slug} en ${basename(file)} y ${basename(first)}`);
        else seen.set(slug, file);
      }
      expect(duplicates).toEqual([]);
    });

    it.each(batches.map(({ file }) => file))(
      'prefijo en-/es- coincide con language en %s',
      (file) => {
        for (const quiz of quizzesOf(file)) {
          const prefix = quiz.slug?.slice(0, 3);
          if (prefix === 'en-') {
            expect(quiz.language, `${basename(file)}: ${quiz.slug}`).toBe('en');
          } else if (prefix === 'es-') {
            expect(quiz.language, `${basename(file)}: ${quiz.slug}`).toBe('es');
          } else {
            expect.unreachable(`${basename(file)}: slug sin prefijo en-/es-: ${quiz.slug}`);
          }
        }
      }
    );
  });

  describe('categorías', () => {
    it.each(batches.map(({ file }) => file))('%s usa solo categorías reales', (file) => {
      for (const quiz of quizzesOf(file)) {
        expect(
          CATEGORIES.has(quiz.category ?? ''),
          `${basename(file)}: ${quiz.slug} con categoría desconocida "${quiz.category}"`
        ).toBe(true);
      }
    });
  });

  describe('trivia', () => {
    it.each(batches.map(({ file }) => file))(
      '%s: una sola correcta, 2-6 opciones, explicación',
      (file) => {
        for (const quiz of quizzesOf(file)) {
          if (quiz.quiz_type !== 'trivia') continue;
          for (const question of quiz.questions ?? []) {
            const options = question.options ?? [];
            expect(
              options.length,
              `${basename(file)}: ${quiz.slug} / ${question.id}`
            ).toBeGreaterThanOrEqual(2);
            expect(
              options.length,
              `${basename(file)}: ${quiz.slug} / ${question.id}`
            ).toBeLessThanOrEqual(6);
            const correct = options.filter((o) => o.is_correct === true);
            expect(
              correct.length,
              `${basename(file)}: ${quiz.slug} / ${question.id} debe tener una sola opción correcta`
            ).toBe(1);
            for (const option of options) {
              expect(
                (option.text ?? '').trim().length,
                `${basename(file)}: ${quiz.slug} / ${question.id} tiene opción vacía`
              ).toBeGreaterThan(0);
            }
            expect(
              (question.explanation ?? '').trim().length,
              `${basename(file)}: ${quiz.slug} / ${question.id} sin explanation`
            ).toBeGreaterThan(0);
          }
        }
      }
    );
  });

  describe('personalidad', () => {
    it.each(batches.map(({ file }) => file))('%s: opciones con tags y >=4 resultados', (file) => {
      for (const quiz of quizzesOf(file)) {
        if (quiz.quiz_type !== 'personality') continue;
        for (const question of quiz.questions ?? []) {
          const options = question.options ?? [];
          expect(
            options.length,
            `${basename(file)}: ${quiz.slug} / ${question.id}`
          ).toBeGreaterThanOrEqual(2);
          expect(
            options.length,
            `${basename(file)}: ${quiz.slug} / ${question.id}`
          ).toBeLessThanOrEqual(6);
          for (const option of options) {
            expect(
              (option.personality_tags ?? []).length,
              `${basename(file)}: ${quiz.slug} / ${question.id} opción sin personality_tags`
            ).toBeGreaterThanOrEqual(1);
          }
        }
        expect(
          (quiz.results ?? []).length,
          `${basename(file)}: ${quiz.slug} necesita >=4 results`
        ).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe('copy', () => {
    it.each(batches.map(({ file }) => file))(
      '%s: description entre 60 y 320 caracteres',
      (file) => {
        for (const quiz of quizzesOf(file)) {
          const length = (quiz.description ?? '').trim().length;
          expect(
            length,
            `${basename(file)}: ${quiz.slug} description de ${length} caracteres`
          ).toBeGreaterThanOrEqual(60);
          expect(
            length,
            `${basename(file)}: ${quiz.slug} description de ${length} caracteres`
          ).toBeLessThanOrEqual(320);
        }
      }
    );

    it('títulos únicos por idioma en todo el repo', () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const { file, quiz } of allQuizzes) {
        const key = `${quiz.language}::${(quiz.title ?? '').trim().toLowerCase()}`;
        const first = seen.get(key);
        if (first) {
          duplicates.push(
            `"${quiz.title}" (${quiz.language}) en ${basename(file)} y ${basename(first)}`
          );
        } else {
          seen.set(key, file);
        }
      }
      expect(duplicates).toEqual([]);
    });
  });

  describe('overrides de título', () => {
    it('slugs únicos entre todos los archivos de overrides', () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const name of overrideFiles) {
        const file = join(SEED_SCRIPTS_DIR, name);
        for (const entry of quizzesOf(file) as Array<{ slug?: string; title?: string }>) {
          const slug = entry.slug ?? '(sin slug)';
          const first = seen.get(slug);
          if (first) duplicates.push(`${slug} en ${name} y ${first}`);
          else seen.set(slug, name);
        }
      }
      expect(duplicates).toEqual([]);
    });

    it.each(overrideFiles)('%s no conserva moldes viejos de título', (name) => {
      const entries = quizzesOf(join(SEED_SCRIPTS_DIR, name)) as Array<{
        slug?: string;
        title?: string;
      }>;
      for (const entry of entries) {
        const title = entry.title ?? '';
        expect(
          /Fan Trivia Challenge$/.test(title) || /^Trivia fan de /.test(title),
          `${name}: ${entry.slug} conserva molde viejo "${title}"`
        ).toBe(false);
      }
    });
  });
});
