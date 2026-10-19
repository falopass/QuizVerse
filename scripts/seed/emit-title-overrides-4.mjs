#!/usr/bin/env node
/**
 * Emits title overrides for the 98 quizzes still stuck in the
 * "What role would you play inside {Franchise}?" / "¿Qué rol jugarías dentro
 * de {Franquicia}?" mold (batch CONT-20). Reads { slug, title } pairs from
 * quiz-title-overrides-4.json and emits one idempotent UPDATE per slug;
 * no other field is touched.
 *
 *   node scripts/seed/emit-title-overrides-4.mjs                # print SQL to stdout
 *   node scripts/seed/emit-title-overrides-4.mjs --check        # validate only
 *   node scripts/seed/emit-title-overrides-4.mjs --write        # write the .sql file
 *   node scripts/seed/emit-title-overrides-4.mjs --write --out supabase/seed/quiz-title-overrides-4.sql
 *   node scripts/seed/emit-title-overrides-4.mjs --input <file> [--json]
 *
 * The script validates before emitting: slugs must belong to the closed list
 * below, titles must be 30–65 chars and free of the old mold, and the
 * catalogue (generated/trending-seed.json) must still show the mold title —
 * if it does not, someone already renamed the quiz and the run fails.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OVERRIDES_PATH = join(ROOT, 'scripts', 'seed', 'quiz-title-overrides-4.json');
const CATALOGUE_PATH = join(ROOT, 'generated', 'trending-seed.json');
const OUTPUT_PATH = join(ROOT, 'supabase', 'seed', 'quiz-title-overrides-4.sql');

const TITLE_MIN = 30;
const TITLE_MAX = 65;

const MOLD_PATTERNS = [/^what role would you play inside /i, /^¿qué rol jugarías dentro de /i];

// Closed list: every quiz whose catalogue title still follows the mold.
const CLOSED_LIST = [
  'en-what-role-would-you-play-inside-the-boys',
  'es-que-rol-jugarias-dentro-de-the-boys',
  'en-what-role-would-you-play-inside-stranger-things',
  'en-what-role-would-you-play-inside-euphoria',
  'es-que-rol-jugarias-dentro-de-euphoria',
  'en-what-role-would-you-play-inside-beef',
  'es-que-rol-jugarias-dentro-de-beef',
  'en-what-role-would-you-play-inside-hacks',
  'es-que-rol-jugarias-dentro-de-hacks',
  'en-what-role-would-you-play-inside-star-wars',
  'es-que-rol-jugarias-dentro-de-star-wars',
  'en-what-role-would-you-play-inside-re-zero',
  'es-que-rol-jugarias-dentro-de-re-zero',
  'en-what-role-would-you-play-inside-witch-hat-atelier',
  'es-que-rol-jugarias-dentro-de-witch-hat-atelier',
  'en-what-role-would-you-play-inside-classroom-of-the-elite',
  'es-que-rol-jugarias-dentro-de-classroom-of-the-elite',
  'en-what-role-would-you-play-inside-dr-stone',
  'en-what-role-would-you-play-inside-that-time-i-got-reincarnated-as-a-sli',
  'en-what-role-would-you-play-inside-the-super-mario-galaxy-movie',
  'en-what-role-would-you-play-inside-project-hail-mary',
  'en-what-role-would-you-play-inside-the-mummy',
  'en-what-role-would-you-play-inside-grand-theft-auto-vi',
  'en-what-role-would-you-play-inside-resident-evil',
  'es-que-rol-jugarias-dentro-de-resident-evil',
  'en-what-role-would-you-play-inside-hades-ii',
  'es-que-rol-jugarias-dentro-de-hades-ii',
  'en-what-role-would-you-play-inside-starfield',
  'es-que-rol-jugarias-dentro-de-starfield',
  'en-what-role-would-you-play-inside-invincible',
  'es-que-rol-jugarias-dentro-de-invincible',
  'en-what-role-would-you-play-inside-harry-potter',
  'en-what-role-would-you-play-inside-marvel',
  'es-que-rol-jugarias-dentro-de-marvel',
  'en-what-role-would-you-play-inside-naruto',
  'es-que-rol-jugarias-dentro-de-naruto',
  'en-what-role-would-you-play-inside-one-piece',
  'es-que-rol-jugarias-dentro-de-one-piece',
  'en-what-role-would-you-play-inside-demon-slayer',
  'en-what-role-would-you-play-inside-jujutsu-kaisen',
  'es-que-rol-jugarias-dentro-de-jujutsu-kaisen',
  'en-what-role-would-you-play-inside-attack-on-titan',
  'es-que-rol-jugarias-dentro-de-attack-on-titan',
  'en-what-role-would-you-play-inside-pokemon',
  'es-que-rol-jugarias-dentro-de-pokemon',
  'en-what-role-would-you-play-inside-the-legend-of-zelda',
  'es-que-rol-jugarias-dentro-de-the-legend-of-zelda',
  'en-what-role-would-you-play-inside-taylor-swift',
  'es-que-rol-jugarias-dentro-de-taylor-swift',
  'en-what-role-would-you-play-inside-k-pop',
  'en-what-role-would-you-play-inside-wicked',
  'es-que-rol-jugarias-dentro-de-wicked',
  'en-what-role-would-you-play-inside-severance',
  'es-que-rol-jugarias-dentro-de-lumon',
  'en-what-role-would-you-play-inside-the-last-of-us',
  'es-que-rol-jugarias-dentro-de-the-last-of-us',
  'en-what-role-would-you-play-inside-the-white-lotus',
  'es-que-rol-jugarias-dentro-de-the-white-lotus',
  'en-what-role-would-you-play-inside-the-bear',
  'es-que-rol-jugarias-dentro-de-the-bear',
  'en-what-role-would-you-play-inside-squid-game',
  'es-que-rol-jugarias-dentro-de-el-juego-del-calamar',
  'en-what-role-would-you-play-inside-wednesday',
  'es-que-rol-jugarias-dentro-de-merlina',
  'en-what-role-would-you-play-inside-bridgerton',
  'es-que-rol-jugarias-dentro-de-bridgerton',
  'en-what-role-would-you-play-inside-solo-leveling',
  'es-que-rol-jugarias-dentro-de-solo-leveling',
  'en-what-role-would-you-play-inside-frieren',
  'es-que-rol-jugarias-dentro-de-frieren',
  'en-what-role-would-you-play-inside-chainsaw-man',
  'es-que-rol-jugarias-dentro-de-chainsaw-man',
  'en-what-role-would-you-play-inside-spy-x-family',
  'es-que-rol-jugarias-dentro-de-spy-x-family',
  'en-what-role-would-you-play-inside-dune',
  'es-que-rol-jugarias-dentro-de-dune',
  'en-what-role-would-you-play-inside-avatar',
  'es-que-rol-jugarias-dentro-de-avatar',
  'en-what-role-would-you-play-inside-barbie',
  'es-que-rol-jugarias-dentro-de-barbie',
  'en-what-role-would-you-play-inside-oppenheimer',
  'es-que-rol-jugarias-dentro-de-oppenheimer',
  'en-what-role-would-you-play-inside-spider-verse',
  'en-what-role-would-you-play-inside-nintendo-switch-2',
  'es-que-rol-jugarias-dentro-de-nintendo-switch-2',
  'en-what-role-would-you-play-inside-baldur-s-gate-3',
  'en-what-role-would-you-play-inside-elden-ring',
  'es-que-rol-jugarias-dentro-de-elden-ring',
  'en-what-role-would-you-play-inside-minecraft',
  'es-que-rol-jugarias-dentro-de-minecraft',
  'en-what-role-would-you-play-inside-chappell-roan',
  'es-que-rol-jugarias-dentro-de-chappell-roan',
  'en-what-role-would-you-play-inside-sabrina-carpenter',
  'es-que-rol-jugarias-dentro-de-sabrina-carpenter',
  'en-what-role-would-you-play-inside-beyonce',
  'es-que-rol-jugarias-dentro-de-beyonce',
  'en-what-role-would-you-play-inside-bad-bunny',
  'es-que-rol-jugarias-dentro-de-bad-bunny',
];

const CLOSED_SET = new Set(CLOSED_LIST);

function validate(overrides, catalogueBySlug) {
  const errors = [];
  const seenSlugs = new Set();
  const seenTitles = new Set();

  overrides.forEach((entry, index) => {
    const where = `override[${index}] ${entry?.slug ?? '(no slug)'}`;

    if (!entry || typeof entry !== 'object') {
      errors.push(`${where}: entry must be an object`);
      return;
    }
    const keys = Object.keys(entry).sort();
    if (keys.join(',') !== 'slug,title') {
      errors.push(`${where}: entries must only carry slug and title`);
    }

    if (typeof entry.slug !== 'string' || !/^(en|es)-[a-z0-9-]+$/.test(entry.slug)) {
      errors.push(`${where}: invalid slug`);
    } else {
      if (!CLOSED_SET.has(entry.slug)) {
        errors.push(`${where}: slug is not in the closed override list`);
      }
      if (seenSlugs.has(entry.slug)) errors.push(`${where}: duplicate slug`);
      seenSlugs.add(entry.slug);

      const quiz = catalogueBySlug.get(entry.slug);
      if (!quiz) {
        errors.push(`${where}: slug not found in the catalogue seed`);
      } else if (!MOLD_PATTERNS.some((pattern) => pattern.test(quiz.title))) {
        errors.push(`${where}: catalogue title no longer matches the mold (already renamed?)`);
      }
    }

    if (typeof entry.title !== 'string') {
      errors.push(`${where}: missing title`);
    } else {
      if (entry.title.length < TITLE_MIN || entry.title.length > TITLE_MAX) {
        errors.push(`${where}: title must be ${TITLE_MIN}–${TITLE_MAX} characters`);
      }
      if (MOLD_PATTERNS.some((pattern) => pattern.test(entry.title))) {
        errors.push(`${where}: title still uses the old mold`);
      }
      if (seenTitles.has(entry.title)) errors.push(`${where}: duplicate title`);
      seenTitles.add(entry.title);
    }
  });

  const missing = CLOSED_LIST.filter((slug) => !seenSlugs.has(slug));
  if (missing.length > 0) {
    errors.push(`missing overrides for ${missing.length} closed-list slugs: ${missing.join(', ')}`);
  }

  return errors;
}

function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSql(overrides) {
  const statements = [
    '-- Quiz title overrides, batch 4 (CONT-20). Generated by scripts/seed/emit-title-overrides-4.mjs — do not edit by hand.',
    '-- Idempotent: each UPDATE targets one slug and rewrites the same title on re-run.',
    '-- Applying is manual: review the file, then run it against the database when the owner decides.',
    'begin;',
  ];

  for (const { slug, title } of overrides) {
    statements.push(
      `UPDATE public.quizzes SET title = ${escapeSqlLiteral(title)}, updated_at = now() WHERE slug = ${escapeSqlLiteral(slug)};`
    );
  }

  statements.push('commit;');
  return `${statements.join('\n\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  const asJson = process.argv.includes('--json');

  const outIndex = process.argv.indexOf('--out');
  const outArg = outIndex === -1 ? null : process.argv[outIndex + 1];
  if (outIndex !== -1 && (!outArg || outArg.startsWith('--'))) {
    console.error('--out needs a path, e.g. --out supabase/seed/quiz-title-overrides-4.sql');
    process.exit(1);
  }
  const inputIndex = process.argv.indexOf('--input');
  const inputArg = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (inputIndex !== -1 && (!inputArg || inputArg.startsWith('--'))) {
    console.error('--input needs a path, e.g. --input scripts/seed/quiz-title-overrides-4.json');
    process.exit(1);
  }

  const outputPath = outArg ? resolve(ROOT, outArg) : OUTPUT_PATH;
  const inputPath = inputArg ? resolve(inputArg) : OVERRIDES_PATH;

  const parsed = JSON.parse(readFileSync(inputPath, 'utf8'));
  const overrides = Array.isArray(parsed) ? parsed : [];
  const catalogue = JSON.parse(readFileSync(CATALOGUE_PATH, 'utf8'));
  const catalogueBySlug = new Map(
    (Array.isArray(catalogue) ? catalogue : []).map((quiz) => [quiz.slug, quiz])
  );

  const errors =
    overrides.length > 0
      ? validate(overrides, catalogueBySlug)
      : [`${inputPath}: must be a nonempty array of { slug, title } pairs`];

  if (errors.length > 0) {
    if (asJson) {
      console.error(JSON.stringify({ errors }));
    } else {
      console.error(`Title overrides validation failed (${errors.length}):`);
      for (const error of errors) console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const sql = buildSql(overrides);
  if (checkOnly) {
    console.log(`Validated: ${overrides.length} title overrides`);
    return;
  }
  if (write) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, sql, 'utf8');
    console.log(`Wrote ${outputPath} (${overrides.length} overrides)`);
  } else {
    process.stdout.write(sql);
  }
  console.log(`Validated: ${overrides.length} title overrides`);
}

main();
