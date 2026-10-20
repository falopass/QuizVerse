/**
 * Tests herméticos del auditor de brecha de importación
 * (`node scripts/seo/audit-import-gap.mjs`). Sin red: solo las funciones
 * puras `parseSitemapSlugs`, `collectSeedSlugs` y `buildImportGap` contra
 * fixtures embebidos y un directorio temporal.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  buildImportGap,
  collectSeedSlugs,
  parseSitemapSlugs,
} from '../scripts/seo/audit-import-gap.mjs';

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://quizverse.org/en</loc></url>
  <url><loc>https://quizverse.org/en/quiz/space-trivia</loc></url>
  <url><loc>https://quizverse.org/es/quiz/trivia-espacial</loc></url>
  <url><loc>https://quizverse.org/en/quiz/anime-quiz</loc></url>
  <url><loc>https://quizverse.org/en/category/movies-tv</loc></url>
</urlset>`;

const tmpDirs: string[] = [];

async function seedDir(files: Record<string, { quizzes: { slug: string }[] }>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'import-gap-'));
  tmpDirs.push(dir);
  for (const [name, seed] of Object.entries(files)) {
    await writeFile(path.join(dir, name), JSON.stringify(seed));
  }
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parseSitemapSlugs', () => {
  it('extrae los slugs de las URLs /quiz/ e ignora el resto', () => {
    expect(parseSitemapSlugs(SITEMAP_XML)).toEqual(
      new Set(['space-trivia', 'trivia-espacial', 'anime-quiz'])
    );
  });
});

describe('collectSeedSlugs', () => {
  it('agrupa los slugs por lote y omite archivos que no son editorial-seed', async () => {
    const dir = await seedDir({
      'editorial-seed-2026b.json': {
        quizzes: [{ slug: 'space-trivia' }, { slug: 'ocean-trivia' }],
      },
      'editorial-seed-2026c.json': {
        quizzes: [{ slug: 'anime-quiz' }, { slug: 'pending-quiz' }],
      },
      'neutral-spanish-overrides.json': { quizzes: [{ slug: 'not-a-lot' }] },
    });
    expect(await collectSeedSlugs(dir)).toEqual([
      { lot: 'editorial-seed-2026b', slugs: ['space-trivia', 'ocean-trivia'] },
      { lot: 'editorial-seed-2026c', slugs: ['anime-quiz', 'pending-quiz'] },
    ]);
  });
});

describe('buildImportGap', () => {
  const seeded = [
    { lot: 'editorial-seed-2026b', slugs: ['space-trivia', 'ocean-trivia'] },
    { lot: 'editorial-seed-2026c', slugs: ['anime-quiz', 'pending-quiz'] },
  ];

  it('cuenta los pendientes por lote y en total', () => {
    const gap = buildImportGap(seeded, parseSitemapSlugs(SITEMAP_XML));
    expect(gap.totals).toEqual({ seeds: 4, live: 3, pending: 2 });
    expect(gap.byLot).toEqual([
      { lot: 'editorial-seed-2026b', pending: ['ocean-trivia'] },
      { lot: 'editorial-seed-2026c', pending: ['pending-quiz'] },
    ]);
  });

  it('un slug publicado no aparece como pendiente', () => {
    const gap = buildImportGap(seeded, parseSitemapSlugs(SITEMAP_XML));
    const pending = gap.byLot.flatMap((lot: { pending: string[] }) => lot.pending);
    expect(pending).not.toContain('space-trivia');
    expect(pending).not.toContain('anime-quiz');
  });
});
