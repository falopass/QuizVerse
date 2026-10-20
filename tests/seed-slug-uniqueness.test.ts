import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_DIR = join(__dirname, '..', 'scripts', 'seed');

interface SeedFile {
  quizzes?: { slug?: string }[];
}

// Cada quiz editorial inserta con ON CONFLICT (slug) DO NOTHING: un slug
// repetido entre lotes descarta el quiz en silencio. Este test es la puerta
// que impide que dos lotes vuelvan a compartir slug.
describe('unicidad de slugs entre lotes editoriales', () => {
  const files = readdirSync(SEED_DIR).filter((name) => /^editorial-seed.*\.json$/.test(name));

  it('ningún slug aparece en más de un archivo ni dos veces en el mismo', () => {
    const collisions: string[] = [];
    for (const name of files) {
      const data = JSON.parse(readFileSync(join(SEED_DIR, name), 'utf8')) as SeedFile;
      const seen = new Set<string>();
      for (const quiz of data.quizzes ?? []) {
        if (!quiz.slug) continue;
        if (seen.has(quiz.slug))
          collisions.push(`${name}: slug "${quiz.slug}" repetido en el archivo`);
        seen.add(quiz.slug);
      }
    }
    const owner = new Map<string, string>();
    for (const name of files) {
      const data = JSON.parse(readFileSync(join(SEED_DIR, name), 'utf8')) as SeedFile;
      for (const quiz of data.quizzes ?? []) {
        if (!quiz.slug) continue;
        const other = owner.get(quiz.slug);
        if (other && other !== name) {
          collisions.push(`slug "${quiz.slug}" está en ${other} y en ${name}`);
        } else {
          owner.set(quiz.slug, name);
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});
