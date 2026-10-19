import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_DIR = join(__dirname, '..', 'scripts', 'seed');
const EMITTER = join(SEED_DIR, 'emit-editorial-seed.mjs');
const CATALOG = join(__dirname, '..', 'generated', 'trending-seed.json');

interface SeedQuiz {
  slug: string;
  language: string;
}

function loadBatch(file: string): SeedQuiz[] {
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { quizzes?: SeedQuiz[] };
  return parsed.quizzes ?? [];
}

const batchFiles = readdirSync(SEED_DIR)
  .filter((name) => /^editorial-seed.*\.json$/.test(name))
  .map((name) => join(SEED_DIR, name))
  .sort();

describe('lotes editoriales en conjunto', () => {
  it('encuentra al menos un lote editorial', () => {
    expect(batchFiles.length).toBeGreaterThanOrEqual(1);
  });

  it.each(batchFiles.map((file) => [file.split('/').pop() ?? file, file]))(
    '%s pasa la validación del emisor',
    (_name, file) => {
      expect(() =>
        execFileSync('node', [EMITTER, '--input', file], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      ).not.toThrow();
    },
  );

  it('ningún slug se repite entre lotes', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const file of batchFiles) {
      const name = file.split('/').pop() ?? file;
      for (const quiz of loadBatch(file)) {
        const previous = seen.get(quiz.slug);
        if (previous && previous !== name) {
          duplicates.push(`slug "${quiz.slug}" está en ${previous} y en ${name}`);
        } else {
          seen.set(quiz.slug, name);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('ningún slug editorial choca con el catálogo importado', () => {
    if (!existsSync(CATALOG)) return;
    const seed = JSON.parse(readFileSync(CATALOG, 'utf8')) as
      | { quizzes?: { slug?: string }[] }
      | { slug?: string }[];
    const catalogQuizzes = Array.isArray(seed) ? seed : (seed.quizzes ?? []);
    const catalogSlugs = new Set(catalogQuizzes.map((quiz) => quiz.slug).filter(Boolean));
    const collisions: string[] = [];
    for (const file of batchFiles) {
      const name = file.split('/').pop() ?? file;
      for (const quiz of loadBatch(file)) {
        if (catalogSlugs.has(quiz.slug)) {
          collisions.push(`slug "${quiz.slug}" de ${name} ya existe en generated/trending-seed.json`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('todo slug lleva el prefijo de su idioma declarado', () => {
    const offenders: string[] = [];
    for (const file of batchFiles) {
      const name = file.split('/').pop() ?? file;
      for (const quiz of loadBatch(file)) {
        if (!/^(en|es)-[a-z0-9-]+$/.test(quiz.slug)) {
          offenders.push(`${name}: slug inválido "${quiz.slug}"`);
        } else if (!quiz.slug.startsWith(`${quiz.language}-`)) {
          offenders.push(`${name}: slug "${quiz.slug}" no empieza con "${quiz.language}-"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
