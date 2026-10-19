#!/usr/bin/env node
/**
 * Emits the batch-2 title overrides (scripts/seed/quiz-title-overrides-2.json)
 * as idempotent SQL UPDATEs.
 *
 * 69 quizzes still carry the imported title moulds "<Franchise> Fan Trivia
 * Challenge" (English) and "Trivia fan de <Franchise>" (Spanish) after batch 1.
 * That string is the <title>, the H1 and the og:title, so this batch rewrites
 * it with search intent: franchise name first, then a concrete hook, 30-65
 * characters.
 *
 *   node scripts/seed/emit-title-overrides-2.mjs               # print SQL to stdout
 *   node scripts/seed/emit-title-overrides-2.mjs --check       # validate only
 *   node scripts/seed/emit-title-overrides-2.mjs --write       # write the .sql file
 *   node scripts/seed/emit-title-overrides-2.mjs --write --out supabase/seed/quiz-title-overrides-2.sql
 *   node scripts/seed/emit-title-overrides-2.mjs --input <file> [--json]
 *
 * The script refuses to emit when an entry falls outside the batch: slug not in
 * the list, language prefix mismatch, a title still on the old template, a
 * title outside 30-65 characters or a repeated title. It also checks
 * generated/trending-seed.json: if the catalogue title of a slug no longer uses
 * the mould, the batch is stale and the script fails instead of overwriting
 * someone else's edit. Nothing is imported by running this; applying the SQL is
 * a separate, manual step.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED_PATH = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides-2.json');
const OUTPUT_PATH = join(ROOT, 'supabase', 'seed', 'quiz-title-overrides-2.sql');
const CATALOGUE_PATH = join(ROOT, 'generated', 'trending-seed.json');

const TITLE_MIN = 30;
const TITLE_MAX = 65;

/** The batch is closed: exactly these 69 slugs may be overridden. */
const BATCH_SLUGS = new Set([
  'en-the-boys-fan-trivia-challenge',
  'es-trivia-fan-de-the-boys',
  'en-stranger-things-fan-trivia-challenge',
  'es-trivia-fan-de-stranger-things',
  'en-star-wars-fan-trivia-challenge',
  'es-trivia-fan-de-star-wars',
  'en-re-zero-fan-trivia-challenge',
  'es-trivia-fan-de-re-zero',
  'en-witch-hat-atelier-fan-trivia-challenge',
  'es-trivia-fan-de-witch-hat-atelier',
  'en-that-time-i-got-reincarnated-as-a-slime-fan-trivia-challenge',
  'es-trivia-fan-de-that-time-i-got-reincarnated-as-a-slime',
  'es-trivia-fan-de-the-super-mario-galaxy-movie',
  'en-project-hail-mary-fan-trivia-challenge',
  'es-trivia-fan-de-project-hail-mary',
  'es-trivia-fan-de-the-mummy',
  'en-the-mummy-fan-trivia-challenge',
  'en-resident-evil-fan-trivia-challenge',
  'es-trivia-fan-de-resident-evil',
  'es-trivia-fan-de-hades-ii',
  'en-starfield-fan-trivia-challenge',
  'es-trivia-fan-de-starfield',
  'en-invincible-fan-trivia-challenge',
  'es-trivia-fan-de-invincible',
  'en-harry-potter-fan-trivia-challenge',
  'es-trivia-fan-de-harry-potter',
  'en-marvel-fan-trivia-challenge',
  'es-trivia-fan-de-marvel',
  'en-naruto-fan-trivia-challenge',
  'es-trivia-fan-de-naruto',
  'en-one-piece-fan-trivia-challenge',
  'es-trivia-fan-de-one-piece',
  'en-jujutsu-kaisen-fan-trivia-challenge',
  'es-trivia-fan-de-jujutsu-kaisen',
  'en-pokemon-fan-trivia-challenge',
  'es-trivia-fan-de-pokemon',
  'en-the-legend-of-zelda-fan-trivia-challenge',
  'es-trivia-fan-de-the-legend-of-zelda',
  'es-trivia-fan-de-taylor-swift',
  'en-taylor-swift-fan-trivia-challenge',
  'en-k-pop-fan-trivia-challenge',
  'es-trivia-fan-de-k-pop',
  'en-wicked-fan-trivia-challenge',
  'es-trivia-fan-de-wicked',
  'en-severance-fan-trivia-challenge',
  'es-trivia-fan-de-severance',
  'en-the-last-of-us-fan-trivia-challenge',
  'es-trivia-fan-de-the-last-of-us',
  'en-the-white-lotus-fan-trivia-challenge',
  'es-trivia-fan-de-the-white-lotus',
  'en-the-bear-fan-trivia-challenge',
  'es-trivia-fan-de-the-bear',
  'en-squid-game-fan-trivia-challenge',
  'en-wednesday-fan-trivia-challenge',
  'es-trivia-fan-de-merlina',
  'en-solo-leveling-fan-trivia-challenge',
  'es-trivia-fan-de-solo-leveling',
  'en-spy-x-family-fan-trivia-challenge',
  'es-trivia-fan-de-spy-x-family',
  'en-oppenheimer-fan-trivia-challenge',
  'es-trivia-fan-de-oppenheimer',
  'en-spider-verse-fan-trivia-challenge',
  'es-trivia-fan-de-spider-verse',
  'en-nintendo-switch-2-fan-trivia-challenge',
  'es-trivia-fan-de-nintendo-switch-2',
  'en-minecraft-fan-trivia-challenge',
  'es-trivia-fan-de-minecraft',
  'en-sabrina-carpenter-fan-trivia-challenge',
  'es-trivia-fan-de-sabrina-carpenter',
]);

/** The moulds this batch exists to remove. */
const OLD_TEMPLATES = [/fan trivia challenge\s*$/i, /^trivia fan de /i];

/** Fails the build instead of silently emitting a bad override. */
function validate(quizzes, catalogue) {
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
    } else {
      const current = catalogue.get(entry.slug);
      if (!current) {
        errors.push(`${where}: slug not found in generated/trending-seed.json`);
      } else if (!OLD_TEMPLATES.some((pattern) => pattern.test(current.title ?? ''))) {
        errors.push(`${where}: catalogue title no longer uses the old template`);
      }
    }
    if (seenSlugs.has(entry.slug)) errors.push(`${where}: duplicate slug`);
    seenSlugs.add(entry.slug);

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
    '-- Title overrides (batch 2) generated by scripts/seed/emit-title-overrides-2.mjs',
    '-- Idempotent: title is set to a fixed value, and the',
    '-- quizzes_content_updated_at trigger keeps updated_at untouched when the',
    '-- row already has it, so re-running changes nothing.',
    '-- Apply:',
    '--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \\',
    '--     < quiz-title-overrides-2.sql',
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

function loadCatalogue() {
  const catalogue = JSON.parse(readFileSync(CATALOGUE_PATH, 'utf8'));
  // trending-seed.json is a plain array; editorial seeds wrap it as { quizzes }.
  const rows = Array.isArray(catalogue) ? catalogue : (catalogue.quizzes ?? []);
  return new Map(rows.map((quiz) => [quiz.slug, quiz]));
}

function main() {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  const asJson = process.argv.includes('--json');
  const outIndex = process.argv.indexOf('--out');
  const outArg = outIndex === -1 ? null : process.argv[outIndex + 1];
  if (outIndex !== -1 && (!outArg || outArg.startsWith('--'))) {
    console.error('--out needs a path, e.g. --out supabase/seed/quiz-title-overrides-2.sql');
    process.exit(1);
  }
  const inputIndex = process.argv.indexOf('--input');
  const inputArg = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (inputIndex !== -1 && (!inputArg || inputArg.startsWith('--'))) {
    console.error('--input needs a path, e.g. --input scripts/seed/quiz-title-overrides-2.json');
    process.exit(1);
  }
  const outputPath = outArg ? resolve(ROOT, outArg) : OUTPUT_PATH;
  const inputPath = inputArg ? resolve(inputArg) : SEED_PATH;
  const seed = JSON.parse(readFileSync(inputPath, 'utf8'));
  const quizzes = Array.isArray(seed.quizzes) ? seed.quizzes : [];
  const catalogue = loadCatalogue();

  // An empty or missing quiz list must not silently overwrite the generated SQL.
  const errors =
    quizzes.length > 0
      ? validate(quizzes, catalogue)
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
  console.log(`Validated ${quizzes.length} title overrides: OK`);
}

main();
