/**
 * Import gap audit — answers "which versioned seed slugs are not published
 * yet" by diffing the editorial/trending seed files against the live sitemap.
 *
 *   node scripts/seo/audit-import-gap.mjs                      # audit production
 *   node scripts/seo/audit-import-gap.mjs --sitemap https://preview.vercel.app/sitemap.xml
 *   node scripts/seo/audit-import-gap.mjs --sitemap cache/live-sitemap.xml
 *
 * Reads slugs from scripts/seed/editorial-seed-*.json (quizzes[].slug) and,
 * if present, generated/trending-seed.normalized.json. Writes
 * generated/audit/import-gap.json and prints a RESULTADO: summary line.
 *
 * Exits 0 on success, 2 when the sitemap cannot be fetched/read (never
 * invents live data).
 */

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SITEMAP = 'https://quizverse.org/sitemap.xml';
const FETCH_TIMEOUT_MS = 20_000;
const SEEDS_DIR = 'scripts/seed';
const TRENDING_SEED = 'generated/trending-seed.normalized.json';
const REPORT_PATH = 'generated/audit/import-gap.json';

/** Slugs of every /quiz/<slug> URL in a sitemap, as a Set. */
export function parseSitemapSlugs(xml) {
  const slugs = new Set();
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const pathname = new URL(match[1]).pathname;
    const quiz = pathname.match(/^\/[a-z]{2}\/quiz\/([^/]+)\/?$/);
    if (quiz) slugs.add(decodeURIComponent(quiz[1]));
  }
  return slugs;
}

/**
 * Slugs per versioned editorial lot in `dir` (editorial-seed-*.json).
 * Returns [{ lot, slugs: string[] }] sorted by lot name.
 */
export async function collectSeedSlugs(dir) {
  const files = (await readdir(dir)).filter((name) => /^editorial-seed.*\.json$/.test(name)).sort();
  const lots = [];
  for (const file of files) {
    const seed = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    lots.push({
      lot: file.replace(/\.json$/, ''),
      slugs: (seed.quizzes ?? []).map((quiz) => quiz.slug).filter(Boolean),
    });
  }
  return lots;
}

/**
 * Pending (seeded but not live) slugs per lot.
 * `seeded`: [{ lot, slugs }]; `live`: Set of published slugs.
 */
export function buildImportGap(seeded, live) {
  const byLot = seeded.map(({ lot, slugs }) => ({
    lot,
    pending: slugs.filter((slug) => !live.has(slug)),
  }));
  const seededCount = seeded.reduce((total, { slugs }) => total + slugs.length, 0);
  const pendingCount = byLot.reduce((total, { pending }) => total + pending.length, 0);
  return {
    totals: { seeds: seededCount, live: live.size, pending: pendingCount },
    byLot,
  };
}

async function loadSitemap(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`GET ${source} → HTTP ${response.status}`);
    return response.text();
  }
  return readFile(source, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const sitemapIndex = args.indexOf('--sitemap');
  const sitemapSource = sitemapIndex === -1 ? DEFAULT_SITEMAP : args[sitemapIndex + 1];
  if (!sitemapSource) {
    console.error('Uso: node scripts/seo/audit-import-gap.mjs [--sitemap <url|ruta>]');
    process.exit(2);
  }

  let xml;
  try {
    xml = await loadSitemap(sitemapSource);
  } catch (error) {
    console.error(`No se pudo obtener el sitemap (${sitemapSource}): ${error.message}`);
    process.exit(2);
  }

  const live = parseSitemapSlugs(xml);
  // Un sitemap 200 sin URLs /quiz/ no prueba que no haya quizzes publicados
  // (la query puede devolver cero filas): sin evidencia, no medimos.
  if (live.size === 0) {
    console.error(
      `El sitemap (${sitemapSource}) no contiene URLs /quiz/; no se puede medir la brecha.`
    );
    process.exit(2);
  }
  const seeded = await collectSeedSlugs(SEEDS_DIR);
  if (existsSync(TRENDING_SEED)) {
    const trending = JSON.parse(await readFile(TRENDING_SEED, 'utf8'));
    const quizzes = Array.isArray(trending) ? trending : (trending.quizzes ?? []);
    seeded.push({
      lot: 'trending-seed.normalized',
      slugs: quizzes.map((quiz) => quiz.slug).filter(Boolean),
    });
  }

  const gap = buildImportGap(seeded, live);
  const report = { generatedAt: new Date().toISOString(), ...gap };
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Informe escrito en ${REPORT_PATH}`);
  console.log(
    `RESULTADO: ${gap.totals.pending} de ${gap.totals.seeds} slugs versionados sin publicar`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Import gap audit failed: ${error.message}`);
    process.exit(1);
  });
}
