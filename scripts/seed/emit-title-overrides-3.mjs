#!/usr/bin/env node
/**
 * Emits the batch-3 title overrides (scripts/seed/quiz-title-overrides-3.json)
 * as idempotent SQL UPDATEs.
 *
 * 55 English quizzes share the exact title template "Which <Franchise> energy
 * matches you best?" and their 55 Spanish twins "¿Qué energía de <Franchise>
 * combina mejor contigo?" — all personality quizzes. That string is the
 * <title>, the H1 and the og:title, so this batch rewrites it with search
 * intent: franchise name first, then a concrete hook, 30-65 characters.
 *
 *   node scripts/seed/emit-title-overrides-3.mjs               # print SQL to stdout
 *   node scripts/seed/emit-title-overrides-3.mjs --check       # validate only
 *   node scripts/seed/emit-title-overrides-3.mjs --write       # write the .sql file
 *   node scripts/seed/emit-title-overrides-3.mjs --write --out supabase/seed/quiz-title-overrides-3.sql
 *   node scripts/seed/emit-title-overrides-3.mjs --input <file> [--json]
 *
 * The script refuses to emit when an entry falls outside the batch: slug not
 * in the list, language prefix mismatch, a title still on the old template, a
 * title outside 30-65 characters or a repeated title. It also checks every
 * slug against generated/trending-seed.json: if the live title no longer
 * matches the old mould, someone already touched it and the run fails.
 * Nothing is imported by running this; applying the SQL is a separate,
 * manual step.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED_PATH = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides-3.json');
const OUTPUT_PATH = join(ROOT, 'supabase', 'seed', 'quiz-title-overrides-3.sql');
const CATALOG_PATH = join(ROOT, 'generated', 'trending-seed.json');

const TITLE_MIN = 30;
const TITLE_MAX = 65;

/** The batch is closed: exactly these 110 slugs may be overridden. */
const BATCH_SLUGS = new Set([
  'en-which-the-boys-energy-matches-you-best',
  'es-que-energia-de-the-boys-combina-mejor-contigo',
  'en-which-stranger-things-energy-matches-you-best',
  'es-que-energia-de-stranger-things-combina-mejor-contigo',
  'en-which-euphoria-energy-matches-you-best',
  'es-que-energia-de-euphoria-combina-mejor-contigo',
  'en-which-beef-energy-matches-you-best',
  'es-que-energia-de-beef-combina-mejor-contigo',
  'en-which-hacks-energy-matches-you-best',
  'es-que-energia-de-hacks-combina-mejor-contigo',
  'en-which-star-wars-energy-matches-you-best',
  'es-que-energia-de-star-wars-combina-mejor-contigo',
  'en-which-re-zero-energy-matches-you-best',
  'es-que-energia-de-re-zero-combina-mejor-contigo',
  'en-which-witch-hat-atelier-energy-matches-you-best',
  'es-que-energia-de-witch-hat-atelier-combina-mejor-contigo',
  'en-which-classroom-of-the-elite-energy-matches-you-best',
  'es-que-energia-de-classroom-of-the-elite-combina-mejor-contigo',
  'en-which-dr-stone-energy-matches-you-best',
  'es-que-energia-de-dr-stone-combina-mejor-contigo',
  'en-which-that-time-i-got-reincarnated-as-a-slime-energy-matches-you-best',
  'es-que-energia-de-that-time-i-got-reincarnated-as-a-slime-combina-mejor-',
  'en-which-the-super-mario-galaxy-movie-energy-matches-you-best',
  'es-que-energia-de-the-super-mario-galaxy-movie-combina-mejor-contigo',
  'en-which-project-hail-mary-energy-matches-you-best',
  'es-que-energia-de-project-hail-mary-combina-mejor-contigo',
  'en-which-the-mummy-energy-matches-you-best',
  'es-que-energia-de-the-mummy-combina-mejor-contigo',
  'en-which-grand-theft-auto-vi-energy-matches-you-best',
  'es-que-energia-de-grand-theft-auto-vi-combina-mejor-contigo',
  'en-which-resident-evil-energy-matches-you-best',
  'es-que-energia-de-resident-evil-combina-mejor-contigo',
  'en-which-hades-ii-energy-matches-you-best',
  'es-que-energia-de-hades-ii-combina-mejor-contigo',
  'en-which-starfield-energy-matches-you-best',
  'es-que-energia-de-starfield-combina-mejor-contigo',
  'en-which-invincible-energy-matches-you-best',
  'es-que-energia-de-invincible-combina-mejor-contigo',
  'en-which-harry-potter-energy-matches-you-best',
  'es-que-energia-de-harry-potter-combina-mejor-contigo',
  'en-which-marvel-energy-matches-you-best',
  'es-que-energia-de-marvel-combina-mejor-contigo',
  'en-which-naruto-energy-matches-you-best',
  'es-que-energia-de-naruto-combina-mejor-contigo',
  'en-which-one-piece-energy-matches-you-best',
  'es-que-energia-de-one-piece-combina-mejor-contigo',
  'en-which-demon-slayer-energy-matches-you-best',
  'es-que-energia-de-demon-slayer-combina-mejor-contigo',
  'en-which-jujutsu-kaisen-energy-matches-you-best',
  'es-que-energia-de-jujutsu-kaisen-combina-mejor-contigo',
  'en-which-attack-on-titan-energy-matches-you-best',
  'es-que-energia-de-attack-on-titan-combina-mejor-contigo',
  'en-which-pokemon-energy-matches-you-best',
  'es-que-energia-de-pokemon-combina-mejor-contigo',
  'en-which-the-legend-of-zelda-energy-matches-you-best',
  'es-que-energia-de-the-legend-of-zelda-combina-mejor-contigo',
  'en-which-taylor-swift-energy-matches-you-best',
  'es-que-energia-de-taylor-swift-combina-mejor-contigo',
  'en-which-k-pop-energy-matches-you-best',
  'es-que-energia-de-k-pop-combina-mejor-contigo',
  'en-which-wicked-energy-matches-you-best',
  'es-que-energia-de-wicked-combina-mejor-contigo',
  'en-which-severance-energy-matches-you-best',
  'es-que-energia-de-severance-combina-mejor-contigo',
  'en-which-the-last-of-us-energy-matches-you-best',
  'es-que-energia-de-the-last-of-us-combina-mejor-contigo',
  'en-which-the-white-lotus-energy-matches-you-best',
  'es-que-energia-de-the-white-lotus-combina-mejor-contigo',
  'en-which-the-bear-energy-matches-you-best',
  'es-que-energia-de-the-bear-combina-mejor-contigo',
  'en-which-squid-game-energy-matches-you-best',
  'es-que-energia-de-el-juego-del-calamar-combina-mejor-contigo',
  'en-which-wednesday-energy-matches-you-best',
  'es-que-energia-de-merlina-combina-mejor-contigo',
  'en-which-bridgerton-energy-matches-you-best',
  'es-que-energia-de-bridgerton-combina-mejor-contigo',
  'en-which-solo-leveling-energy-matches-you-best',
  'es-que-energia-de-solo-leveling-combina-mejor-contigo',
  'en-which-frieren-energy-matches-you-best',
  'es-que-energia-de-frieren-combina-mejor-contigo',
  'en-which-chainsaw-man-energy-matches-you-best',
  'es-que-energia-de-chainsaw-man-combina-mejor-contigo',
  'en-which-spy-x-family-energy-matches-you-best',
  'es-que-energia-de-spy-x-family-combina-mejor-contigo',
  'en-which-dune-energy-matches-you-best',
  'es-que-energia-de-dune-combina-mejor-contigo',
  'en-which-avatar-energy-matches-you-best',
  'es-que-energia-de-avatar-combina-mejor-contigo',
  'en-which-barbie-energy-matches-you-best',
  'es-que-energia-de-barbie-combina-mejor-contigo',
  'en-which-oppenheimer-energy-matches-you-best',
  'es-que-energia-de-oppenheimer-combina-mejor-contigo',
  'en-which-spider-verse-energy-matches-you-best',
  'es-que-energia-de-spider-verse-combina-mejor-contigo',
  'en-which-nintendo-switch-2-energy-matches-you-best',
  'es-que-energia-de-nintendo-switch-2-combina-mejor-contigo',
  'en-which-baldur-s-gate-3-energy-matches-you-best',
  'es-que-energia-de-baldur-s-gate-3-combina-mejor-contigo',
  'en-which-elden-ring-energy-matches-you-best',
  'es-que-energia-de-elden-ring-combina-mejor-contigo',
  'en-which-minecraft-energy-matches-you-best',
  'es-que-energia-de-minecraft-combina-mejor-contigo',
  'en-which-chappell-roan-energy-matches-you-best',
  'es-que-energia-de-chappell-roan-combina-mejor-contigo',
  'en-which-sabrina-carpenter-energy-matches-you-best',
  'es-que-energia-de-sabrina-carpenter-combina-mejor-contigo',
  'en-which-beyonce-energy-matches-you-best',
  'es-que-energia-de-beyonce-combina-mejor-contigo',
  'en-which-bad-bunny-energy-matches-you-best',
  'es-que-energia-de-bad-bunny-combina-mejor-contigo',
]);

/** The moulds this batch exists to remove. */
const OLD_TEMPLATES = [/energy matches you best\??$/i, /combina mejor contigo\??$/i];

function mouldFor(slug) {
  return slug.startsWith('es-') ? /combina mejor contigo\??$/i : /energy matches you best\??$/i;
}

function loadCatalogTitles() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const quizzes = Array.isArray(catalog) ? catalog : catalog.quizzes;
  if (!Array.isArray(quizzes)) {
    throw new Error(`${CATALOG_PATH}: no quiz list found`);
  }
  return new Map(quizzes.map((quiz) => [quiz.slug, quiz.title]));
}

/** Fails the build instead of silently emitting a bad override. */
function validate(quizzes, catalogTitles) {
  const errors = [];
  const seenSlugs = new Set();
  const seenTitles = new Set();

  quizzes.forEach((entry, index) => {
    const where = `quiz[${index}] ${entry?.slug ?? '(no slug)'}`;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${where}: entry must be an object with slug and title`);
      return;
    }
    const extraKeys = Object.keys(entry).filter((key) => key !== 'slug' && key !== 'title');
    if (extraKeys.length > 0) {
      errors.push(`${where}: unexpected fields ${extraKeys.join(', ')}`);
    }

    if (!entry.slug || !/^(en|es)-[a-z0-9-]+$/.test(entry.slug)) {
      errors.push(`${where}: slug must start with the en- or es- language prefix`);
    } else if (!BATCH_SLUGS.has(entry.slug)) {
      errors.push(`${where}: slug is not in the batch list`);
    }
    if (seenSlugs.has(entry.slug)) errors.push(`${where}: duplicate slug`);
    seenSlugs.add(entry.slug);

    // The catalogue snapshot must still show the mould title: a changed title
    // means someone already touched the row and this batch would overwrite it.
    const currentTitle = catalogTitles.get(entry.slug);
    if (currentTitle === undefined) {
      errors.push(`${where}: slug not found in generated/trending-seed.json`);
    } else if (!mouldFor(entry.slug).test(currentTitle)) {
      errors.push(`${where}: current title no longer matches the old mould`);
    }

    if (typeof entry.title !== 'string' || entry.title.trim() === '') {
      errors.push(`${where}: missing title`);
      return;
    }
    if (entry.title.length < TITLE_MIN || entry.title.length > TITLE_MAX) {
      errors.push(`${where}: title must be ${TITLE_MIN}-${TITLE_MAX} characters`);
    }
    if (OLD_TEMPLATES.some((pattern) => pattern.test(entry.title))) {
      errors.push(`${where}: title still uses the old template`);
    }
    const normalized = entry.title.trim().toLowerCase();
    if (seenTitles.has(normalized)) errors.push(`${where}: duplicate title`);
    seenTitles.add(normalized);
  });

  for (const slug of BATCH_SLUGS) {
    if (!seenSlugs.has(slug)) errors.push(`batch: missing override for ${slug}`);
  }

  return errors;
}

function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSql(quizzes) {
  const header = [
    '-- Title overrides (batch 3) generated by scripts/seed/emit-title-overrides-3.mjs',
    '-- Idempotent: title is set to a fixed value, and the',
    '-- quizzes_content_updated_at trigger keeps updated_at untouched when the',
    '-- row already has it, so re-running changes nothing.',
    '-- Nothing is imported automatically: applying this file is a manual step.',
    '-- Apply:',
    '--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \\',
    '--     < quiz-title-overrides-3.sql',
    'begin;',
  ].join('\n');

  const updates = quizzes.map((quiz) =>
    [
      `UPDATE public.quizzes`,
      `SET title = ${escapeSqlLiteral(quiz.title)},`,
      `    updated_at = now()`,
      `WHERE slug = ${escapeSqlLiteral(quiz.slug)};`,
    ].join('\n')
  );

  return `${header}\n\n${updates.join('\n\n')}\n\ncommit;\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  const asJson = process.argv.includes('--json');
  const outIndex = process.argv.indexOf('--out');
  const outArg = outIndex === -1 ? null : process.argv[outIndex + 1];
  if (outIndex !== -1 && (!outArg || outArg.startsWith('--'))) {
    console.error('--out needs a path, e.g. --out supabase/seed/quiz-title-overrides-3.sql');
    process.exit(1);
  }
  const inputIndex = process.argv.indexOf('--input');
  const inputArg = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (inputIndex !== -1 && (!inputArg || inputArg.startsWith('--'))) {
    console.error('--input needs a path, e.g. --input scripts/seed/quiz-title-overrides-3.json');
    process.exit(1);
  }
  const outputPath = outArg ? resolve(ROOT, outArg) : OUTPUT_PATH;
  const inputPath = inputArg ? resolve(inputArg) : SEED_PATH;
  const seed = JSON.parse(readFileSync(inputPath, 'utf8'));
  const quizzes = Array.isArray(seed.quizzes) ? seed.quizzes : [];

  // An empty or missing quiz list must not silently overwrite the generated SQL.
  const errors =
    quizzes.length > 0
      ? validate(quizzes, loadCatalogTitles())
      : [`${inputPath}: "quizzes" must be a nonempty array`];
  if (errors.length > 0) {
    if (asJson) {
      console.error(JSON.stringify({ errors }));
    } else {
      console.error(`Title overrides validation failed (${errors.length}):`);
      for (const error of errors) console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  if (check) {
    console.log(`Validated ${quizzes.length} title overrides: OK`);
    return;
  }

  const sql = buildSql(quizzes);
  if (write) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, sql, 'utf8');
    console.log(`Wrote ${outputPath} (${quizzes.length} title overrides)`);
  } else {
    process.stdout.write(sql);
  }
}

main();
