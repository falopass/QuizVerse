#!/usr/bin/env node
/**
 * Emits the batch-5 title overrides (scripts/seed/quiz-title-overrides-5.json)
 * as idempotent SQL UPDATEs.
 *
 * 55 English quizzes share the exact title template "How deep does your
 * <Franchise> knowledge go?" and their 55 Spanish counterparts "¿Qué tan
 * profundo llega tu conocimiento de <Franchise>?". That string is the <title>,
 * the H1 and the og:title, so this batch rewrites it with search intent:
 * franchise name first, then a concrete hook, 30-65 characters.
 *
 *   node scripts/seed/emit-title-overrides-5.mjs               # print SQL to stdout
 *   node scripts/seed/emit-title-overrides-5.mjs --check       # validate only
 *   node scripts/seed/emit-title-overrides-5.mjs --write       # write the .sql file
 *   node scripts/seed/emit-title-overrides-5.mjs --write --out supabase/seed/quiz-title-overrides-5.sql
 *   node scripts/seed/emit-title-overrides-5.mjs --input <file> [--json]
 *
 * The script refuses to emit when an entry falls outside the batch: slug not in
 * the list, language prefix mismatch, a title still on the old template, a
 * title outside 30-65 characters or a repeated title. It also checks
 * generated/trending-seed.json: if the slug's current title no longer matches
 * the mould, someone already touched it and the run fails. Each emitted UPDATE
 * predicates on that same current title, so a row edited after the import is
 * left untouched and shows up as 0 rows affected. Nothing is imported by
 * running this; applying the SQL is a separate, manual step.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED_PATH = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides-5.json');
const CATALOG_PATH = join(ROOT, 'generated', 'trending-seed.json');
const OUTPUT_PATH = join(ROOT, 'supabase', 'seed', 'quiz-title-overrides-5.sql');

const TITLE_MIN = 30;
const TITLE_MAX = 65;

/** The batch is closed: exactly these 110 slugs may be overridden. */
const BATCH_SLUGS = new Set([
  'en-how-deep-does-your-attack-on-titan-knowledge-go',
  'en-how-deep-does-your-avatar-knowledge-go',
  'en-how-deep-does-your-bad-bunny-knowledge-go',
  'en-how-deep-does-your-baldur-s-gate-3-knowledge-go',
  'en-how-deep-does-your-barbie-knowledge-go',
  'en-how-deep-does-your-beef-knowledge-go',
  'en-how-deep-does-your-beyonce-knowledge-go',
  'en-how-deep-does-your-bridgerton-knowledge-go',
  'en-how-deep-does-your-chainsaw-man-knowledge-go',
  'en-how-deep-does-your-chappell-roan-knowledge-go',
  'en-how-deep-does-your-classroom-of-the-elite-knowledge-go',
  'en-how-deep-does-your-demon-slayer-knowledge-go',
  'en-how-deep-does-your-dr-stone-knowledge-go',
  'en-how-deep-does-your-dune-knowledge-go',
  'en-how-deep-does-your-elden-ring-knowledge-go',
  'en-how-deep-does-your-euphoria-knowledge-go',
  'en-how-deep-does-your-frieren-knowledge-go',
  'en-how-deep-does-your-grand-theft-auto-vi-knowledge-go',
  'en-how-deep-does-your-hades-ii-knowledge-go',
  'en-how-deep-does-your-hacks-knowledge-go',
  'en-how-deep-does-your-harry-potter-knowledge-go',
  'en-how-deep-does-your-invincible-knowledge-go',
  'en-how-deep-does-your-jujutsu-kaisen-knowledge-go',
  'en-how-deep-does-your-k-pop-knowledge-go',
  'en-how-deep-does-your-marvel-knowledge-go',
  'en-how-deep-does-your-minecraft-knowledge-go',
  'en-how-deep-does-your-naruto-knowledge-go',
  'en-how-deep-does-your-nintendo-switch-2-knowledge-go',
  'en-how-deep-does-your-one-piece-knowledge-go',
  'en-how-deep-does-your-oppenheimer-knowledge-go',
  'en-how-deep-does-your-pokemon-knowledge-go',
  'en-how-deep-does-your-project-hail-mary-knowledge-go',
  'en-how-deep-does-your-re-zero-knowledge-go',
  'en-how-deep-does-your-resident-evil-knowledge-go',
  'en-how-deep-does-your-sabrina-carpenter-knowledge-go',
  'en-how-deep-does-your-severance-knowledge-go',
  'en-how-deep-does-your-solo-leveling-knowledge-go',
  'en-how-deep-does-your-spider-verse-knowledge-go',
  'en-how-deep-does-your-spy-x-family-knowledge-go',
  'en-how-deep-does-your-squid-game-knowledge-go',
  'en-how-deep-does-your-star-wars-knowledge-go',
  'en-how-deep-does-your-starfield-knowledge-go',
  'en-how-deep-does-your-stranger-things-knowledge-go',
  'en-how-deep-does-your-taylor-swift-knowledge-go',
  'en-how-deep-does-your-that-time-i-got-reincarnated-as-a-slime-knowledge-',
  'en-how-deep-does-your-the-bear-knowledge-go',
  'en-how-deep-does-your-the-boys-knowledge-go',
  'en-how-deep-does-your-the-last-of-us-knowledge-go',
  'en-how-deep-does-your-the-legend-of-zelda-knowledge-go',
  'en-how-deep-does-your-the-mummy-knowledge-go',
  'en-how-deep-does-your-the-super-mario-galaxy-movie-knowledge-go',
  'en-how-deep-does-your-the-white-lotus-knowledge-go',
  'en-how-deep-does-your-wednesday-knowledge-go',
  'en-how-deep-does-your-wicked-knowledge-go',
  'en-how-deep-does-your-witch-hat-atelier-knowledge-go',
  'es-que-tan-profundo-llega-tu-conocimiento-de-attack-on-titan',
  'es-que-tan-profundo-llega-tu-conocimiento-de-avatar',
  'es-que-tan-profundo-llega-tu-conocimiento-de-bad-bunny',
  'es-que-tan-profundo-llega-tu-conocimiento-de-baldur-s-gate-3',
  'es-que-tan-profundo-llega-tu-conocimiento-de-barbie',
  'es-que-tan-profundo-llega-tu-conocimiento-de-beef',
  'es-que-tan-profundo-llega-tu-conocimiento-de-beyonce',
  'es-que-tan-profundo-llega-tu-conocimiento-de-bridgerton',
  'es-que-tan-profundo-llega-tu-conocimiento-de-chainsaw-man',
  'es-que-tan-profundo-llega-tu-conocimiento-de-chappell-roan',
  'es-que-tan-profundo-llega-tu-conocimiento-de-classroom-of-the-elite',
  'es-que-tan-profundo-llega-tu-conocimiento-de-demon-slayer',
  'es-que-tan-profundo-llega-tu-conocimiento-de-dr-stone',
  'es-que-tan-profundo-llega-tu-conocimiento-de-dune',
  'es-que-tan-profundo-llega-tu-conocimiento-de-el-juego-del-calamar',
  'es-que-tan-profundo-llega-tu-conocimiento-de-elden-ring',
  'es-que-tan-profundo-llega-tu-conocimiento-de-euphoria',
  'es-que-tan-profundo-llega-tu-conocimiento-de-frieren',
  'es-que-tan-profundo-llega-tu-conocimiento-de-grand-theft-auto-vi',
  'es-que-tan-profundo-llega-tu-conocimiento-de-hacks',
  'es-que-tan-profundo-llega-tu-conocimiento-de-hades-ii',
  'es-que-tan-profundo-llega-tu-conocimiento-de-harry-potter',
  'es-que-tan-profundo-llega-tu-conocimiento-de-invincible',
  'es-que-tan-profundo-llega-tu-conocimiento-de-jujutsu-kaisen',
  'es-que-tan-profundo-llega-tu-conocimiento-de-k-pop',
  'es-que-tan-profundo-llega-tu-conocimiento-de-marvel',
  'es-que-tan-profundo-llega-tu-conocimiento-de-merlina',
  'es-que-tan-profundo-llega-tu-conocimiento-de-minecraft',
  'es-que-tan-profundo-llega-tu-conocimiento-de-naruto',
  'es-que-tan-profundo-llega-tu-conocimiento-de-nintendo-switch-2',
  'es-que-tan-profundo-llega-tu-conocimiento-de-one-piece',
  'es-que-tan-profundo-llega-tu-conocimiento-de-oppenheimer',
  'es-que-tan-profundo-llega-tu-conocimiento-de-pokemon',
  'es-que-tan-profundo-llega-tu-conocimiento-de-project-hail-mary',
  'es-que-tan-profundo-llega-tu-conocimiento-de-re-zero',
  'es-que-tan-profundo-llega-tu-conocimiento-de-resident-evil',
  'es-que-tan-profundo-llega-tu-conocimiento-de-sabrina-carpenter',
  'es-que-tan-profundo-llega-tu-conocimiento-de-severance',
  'es-que-tan-profundo-llega-tu-conocimiento-de-solo-leveling',
  'es-que-tan-profundo-llega-tu-conocimiento-de-spider-verse',
  'es-que-tan-profundo-llega-tu-conocimiento-de-spy-x-family',
  'es-que-tan-profundo-llega-tu-conocimiento-de-star-wars',
  'es-que-tan-profundo-llega-tu-conocimiento-de-starfield',
  'es-que-tan-profundo-llega-tu-conocimiento-de-stranger-things',
  'es-que-tan-profundo-llega-tu-conocimiento-de-taylor-swift',
  'es-que-tan-profundo-llega-tu-conocimiento-de-that-time-i-got-reincarnate',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-bear',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-boys',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-last-of-us',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-legend-of-zelda',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-mummy',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-super-mario-galaxy-movi',
  'es-que-tan-profundo-llega-tu-conocimiento-de-the-white-lotus',
  'es-que-tan-profundo-llega-tu-conocimiento-de-wicked',
  'es-que-tan-profundo-llega-tu-conocimiento-de-witch-hat-atelier',
]);

/** The moulds this batch exists to remove. */
const OLD_TEMPLATES = [
  /^how deep does your .* knowledge go\?$/i,
  /^¿qué tan profundo llega tu conocimiento de /i,
];

/** slug -> current title in the imported catalogue. */
function loadCurrentTitles() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  return new Map(catalog.map((quiz) => [quiz.slug, quiz.title]));
}

/** Fails the build instead of silently emitting a bad override. */
function validate(quizzes, currentTitles) {
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
      const current = currentTitles.get(entry.slug);
      if (current === undefined) {
        errors.push(`${where}: slug not found in generated/trending-seed.json`);
      } else if (!OLD_TEMPLATES.some((pattern) => pattern.test(current))) {
        errors.push(`${where}: current title no longer uses the mould`);
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

function buildSql(quizzes, currentTitles) {
  const header = [
    '-- Title overrides (batch 5) generated by scripts/seed/emit-title-overrides-5.mjs',
    '-- Idempotent: each UPDATE predicates on the title the quiz had at import,',
    '-- so a row already overridden or edited afterwards is left untouched.',
    '-- When applying, every statement must report UPDATE 1; an UPDATE 0 means',
    '-- that quiz title changed since the catalogue snapshot — review it by hand.',
    '-- Nothing is imported by the generator; applying this file is manual:',
    '--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \\',
    '--     < quiz-title-overrides-5.sql',
    'begin;',
  ].join('\n');

  const updates = quizzes.map((quiz) =>
    [
      `UPDATE public.quizzes`,
      `SET title = ${escapeSqlLiteral(quiz.title)},`,
      `    updated_at = now()`,
      `WHERE slug = ${escapeSqlLiteral(quiz.slug)}`,
      `  AND title = ${escapeSqlLiteral(currentTitles.get(quiz.slug))};`,
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
    console.error('--out needs a path, e.g. --out supabase/seed/quiz-title-overrides-5.sql');
    process.exit(1);
  }
  const inputIndex = process.argv.indexOf('--input');
  const inputArg = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (inputIndex !== -1 && (!inputArg || inputArg.startsWith('--'))) {
    console.error('--input needs a path, e.g. --input scripts/seed/quiz-title-overrides-5.json');
    process.exit(1);
  }
  const outputPath = outArg ? resolve(ROOT, outArg) : OUTPUT_PATH;
  const inputPath = inputArg ? resolve(inputArg) : SEED_PATH;
  const seed = JSON.parse(readFileSync(inputPath, 'utf8'));
  const quizzes = Array.isArray(seed.quizzes) ? seed.quizzes : [];

  // An empty or missing quiz list must not silently overwrite the generated SQL.
  const currentTitles = quizzes.length > 0 ? loadCurrentTitles() : new Map();
  const errors =
    quizzes.length > 0
      ? validate(quizzes, currentTitles)
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

  const sql = buildSql(quizzes, currentTitles);
  if (write) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, sql, 'utf8');
    console.log(`Wrote ${outputPath} (${quizzes.length} title overrides)`);
  } else {
    process.stdout.write(sql);
  }
}

main();
