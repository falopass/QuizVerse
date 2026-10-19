#!/usr/bin/env node
/**
 * Emits the batch-1 title overrides (scripts/seed/quiz-title-overrides.json) as
 * idempotent SQL UPDATEs.
 *
 * 54 English quizzes share the exact title template "<Franchise> Fan Trivia
 * Challenge" and 56 Spanish ones "Trivia fan de <Franchise>" — 21% of the
 * catalogue under two moulds, several under 28 characters. That string is the
 * <title>, the H1 and the og:title, so this batch rewrites it with search
 * intent: franchise name first, then a concrete hook, 30-65 characters.
 *
 *   node scripts/seed/emit-title-overrides.mjs               # print SQL to stdout
 *   node scripts/seed/emit-title-overrides.mjs --check       # validate only
 *   node scripts/seed/emit-title-overrides.mjs --write       # write the .sql file
 *   node scripts/seed/emit-title-overrides.mjs --write --out supabase/seed/quiz-title-overrides.sql
 *   node scripts/seed/emit-title-overrides.mjs --input <file> [--json]
 *
 * The script refuses to emit when an entry falls outside the batch: slug not in
 * the list, language prefix mismatch, a title still on the old template, a
 * title outside 30-65 characters or a repeated title. Nothing is imported by
 * running this; applying the SQL is a separate, manual step.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED_PATH = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides.json');
const OUTPUT_PATH = join(ROOT, 'supabase', 'seed', 'quiz-title-overrides.sql');

const TITLE_MIN = 30;
const TITLE_MAX = 65;

/** The batch is closed: exactly these 40 slugs may be overridden. */
const BATCH_SLUGS = new Set([
  'en-attack-on-titan-fan-trivia-challenge',
  'en-avatar-fan-trivia-challenge',
  'en-bad-bunny-fan-trivia-challenge',
  'en-baldur-s-gate-3-fan-trivia-challenge',
  'en-barbie-fan-trivia-challenge',
  'en-beef-fan-trivia-challenge',
  'en-beyonce-fan-trivia-challenge',
  'en-bridgerton-fan-trivia-challenge',
  'en-chainsaw-man-fan-trivia-challenge',
  'en-chappell-roan-fan-trivia-challenge',
  'en-classroom-of-the-elite-fan-trivia-challenge',
  'en-demon-slayer-fan-trivia-challenge',
  'en-dr-stone-fan-trivia-challenge',
  'en-dune-fan-trivia-challenge',
  'en-elden-ring-fan-trivia-challenge',
  'en-euphoria-fan-trivia-challenge',
  'en-frieren-fan-trivia-challenge',
  'en-grand-theft-auto-vi-fan-trivia-challenge',
  'en-hacks-fan-trivia-challenge',
  'en-hades-ii-fan-trivia-challenge',
  'es-trivia-fan-de-attack-on-titan',
  'es-trivia-fan-de-avatar',
  'es-trivia-fan-de-bad-bunny',
  'es-trivia-fan-de-baldur-s-gate-3',
  'es-trivia-fan-de-barbie',
  'es-trivia-fan-de-beef',
  'es-trivia-fan-de-beyonce',
  'es-trivia-fan-de-bridgerton',
  'es-trivia-fan-de-chainsaw-man',
  'es-trivia-fan-de-chappell-roan',
  'es-trivia-fan-de-classroom-of-the-elite',
  'es-trivia-fan-de-demon-slayer',
  'es-trivia-fan-de-dr-stone',
  'es-trivia-fan-de-dune',
  'es-trivia-fan-de-el-juego-del-calamar',
  'es-trivia-fan-de-elden-ring',
  'es-trivia-fan-de-euphoria',
  'es-trivia-fan-de-frieren',
  'es-trivia-fan-de-grand-theft-auto-vi',
  'es-trivia-fan-de-hacks',
]);

/** The moulds this batch exists to remove. */
const OLD_TEMPLATES = [/fan trivia challenge\s*$/i, /^trivia fan de /i];

/** Fails the build instead of silently emitting a bad override. */
function validate(quizzes) {
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
    '-- Title overrides (batch 1) generated by scripts/seed/emit-title-overrides.mjs',
    '-- Idempotent: title is set to a fixed value, and the',
    '-- quizzes_content_updated_at trigger keeps updated_at untouched when the',
    '-- row already has it, so re-running changes nothing.',
    '-- Apply:',
    '--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \\',
    '--     < quiz-title-overrides.sql',
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
    console.error('--out needs a path, e.g. --out supabase/seed/quiz-title-overrides.sql');
    process.exit(1);
  }
  const inputIndex = process.argv.indexOf('--input');
  const inputArg = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (inputIndex !== -1 && (!inputArg || inputArg.startsWith('--'))) {
    console.error('--input needs a path, e.g. --input scripts/seed/quiz-title-overrides.json');
    process.exit(1);
  }
  const outputPath = outArg ? resolve(ROOT, outArg) : OUTPUT_PATH;
  const inputPath = inputArg ? resolve(inputArg) : SEED_PATH;
  const seed = JSON.parse(readFileSync(inputPath, 'utf8'));
  const quizzes = Array.isArray(seed.quizzes) ? seed.quizzes : [];

  // An empty or missing quiz list must not silently overwrite the generated SQL.
  const errors =
    quizzes.length > 0 ? validate(quizzes) : [`${inputPath}: "quizzes" must be a nonempty array`];
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
