#!/usr/bin/env node
/**
 * Emits the neutral-Spanish corrections (scripts/seed/neutral-spanish-overrides.json)
 * as idempotent SQL UPDATEs against public.quizzes.
 *
 * The catalogue seed was generated with Rioplatense voseo ("¿Sos un verdadero
 * fan?"); the site targets neutral Spanish (Mexico, Colombia, Chile, Spain).
 * This updates only the prose: title, description and question/option text.
 *
 *   node scripts/seed/emit-neutral-spanish.mjs                 # print SQL to stdout
 *   node scripts/seed/emit-neutral-spanish.mjs --write          # write supabase/seed/neutral-spanish.sql
 *   node scripts/seed/emit-neutral-spanish.mjs --dry-run        # validate only, no SQL
 *   node scripts/seed/emit-neutral-spanish.mjs --input <file>   # alternate overrides file
 *
 * The script refuses to emit when:
 *
 * - a slug is not found in the source seeds (generated/trending-seed.json, then
 *   generated/trending-seed.normalized.json),
 * - an override holds a key other than title/description/questions,
 * - a `questions` override changes the answer key surface: question or option
 *   ids, option counts, `is_correct` flags or `personality_tags` must match the
 *   source quiz exactly (scoring is recomputed server-side against that key),
 * - the corrected prose still matches the voseo regex.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OVERRIDES_PATH = join(ROOT, 'scripts', 'seed', 'neutral-spanish-overrides.json');
const OUTPUT_PATH = join(ROOT, 'supabase', 'seed', 'neutral-spanish.sql');
const SEED_PATHS = [
  join(ROOT, 'generated', 'trending-seed.json'),
  join(ROOT, 'generated', 'trending-seed.normalized.json'),
];

const ALLOWED_KEYS = new Set(['title', 'description', 'questions']);

// Rioplatense voseo markers. The character-class boundaries (instead of \b,
// which treats accented letters as non-word) make "Poné a prueba" match while
// "mostrándoles" or "nuevos" do not.
const VOSEO_RE =
  /(?<![a-záéíóúñü])(poné|sos|tenés|querés|elegí|mirá|sabés|podés|debés|usás|vivís|jugás|sentís|decís|vení|hacé|andá|creés|pensás|estás|vos)(?![a-záéíóúñü])/i;

// Keys that carry prose the override is allowed to change; everything else in a
// question/option is structural (ids, is_correct, personality_tags, timers).
const TEXT_KEYS = new Set(['question', 'explanation', 'text']);

function loadSourceQuizzes() {
  const bySlug = new Map();
  for (const seedPath of SEED_PATHS) {
    const list = JSON.parse(readFileSync(seedPath, 'utf8'));
    if (!Array.isArray(list)) continue;
    for (const quiz of list) {
      // First seed containing the slug wins.
      if (quiz && typeof quiz.slug === 'string' && !bySlug.has(quiz.slug)) {
        bySlug.set(quiz.slug, quiz);
      }
    }
  }
  return bySlug;
}

/** Everything that is not prose: the answer key plus ids must survive untouched. */
function structureOf(questions) {
  return (questions ?? []).map((question) =>
    Object.fromEntries(
      Object.entries(question ?? {})
        .filter(([key]) => !TEXT_KEYS.has(key))
        .map(([key, value]) => [
          key,
          key === 'options' && Array.isArray(value)
            ? value.map((option) =>
                Object.fromEntries(
                  Object.entries(option ?? {}).filter(([optionKey]) => !TEXT_KEYS.has(optionKey))
                )
              )
            : value,
        ])
    )
  );
}

function collectText(override) {
  const chunks = [override.title, override.description];
  for (const question of override.questions ?? []) {
    chunks.push(question?.question, question?.explanation);
    for (const option of question?.options ?? []) chunks.push(option?.text);
  }
  return chunks.filter((chunk) => typeof chunk === 'string').join('\n');
}

/**
 * Top-level keys of a flat JSON object, in order. JSON.parse silently keeps the
 * last value on duplicate keys, so duplicates must be detected on the raw text:
 * at depth 1 inside the root object, a string followed by ':' is a key.
 */
function topLevelKeys(jsonText) {
  const keys = [];
  let depth = 0;
  let index = 0;
  while (index < jsonText.length) {
    const char = jsonText[index];
    if (char === '"') {
      const start = index;
      index += 1;
      while (index < jsonText.length && jsonText[index] !== '"') {
        index += jsonText[index] === '\\' ? 2 : 1;
      }
      const raw = jsonText.slice(start, index + 1);
      index += 1;
      let lookahead = index;
      while (/\s/.test(jsonText[lookahead])) lookahead += 1;
      if (depth === 1 && jsonText[lookahead] === ':') keys.push(JSON.parse(raw));
      continue;
    }
    if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') depth -= 1;
    index += 1;
  }
  return keys;
}

function validate(overrides, sourceBySlug) {
  const errors = [];

  for (const [slug, override] of Object.entries(overrides)) {
    const where = `override ${slug}`;

    if (!override || typeof override !== 'object' || Array.isArray(override)) {
      errors.push(`${where}: must be an object with title/description/questions`);
      continue;
    }
    const keys = Object.keys(override);
    const unknown = keys.filter((key) => !ALLOWED_KEYS.has(key));
    if (unknown.length > 0) errors.push(`${where}: unexpected keys ${unknown.join(', ')}`);
    if (!keys.some((key) => ALLOWED_KEYS.has(key))) {
      errors.push(`${where}: nothing to update (no title, description or questions)`);
    }

    const source = sourceBySlug.get(slug);
    if (!source) {
      errors.push(`${where}: slug not found in any source seed`);
      continue;
    }

    if (override.title !== undefined && override.title === source.title) {
      errors.push(`${where}: title is identical to the source`);
    }
    if (override.description !== undefined && override.description === source.description) {
      errors.push(`${where}: description is identical to the source`);
    }

    if (override.questions !== undefined) {
      if (!Array.isArray(override.questions) || !Array.isArray(source.questions)) {
        errors.push(`${where}: questions must be an array`);
      } else {
        const same =
          JSON.stringify(structureOf(override.questions)) ===
          JSON.stringify(structureOf(source.questions));
        if (!same) {
          errors.push(`${where}: questions change ids/options/is_correct vs the source`);
        }
      }
    }

    if (VOSEO_RE.test(collectText(override))) {
      errors.push(`${where}: corrected text still matches the voseo regex`);
    }
  }

  return errors;
}

function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableLiteral(value) {
  return value === null || value === undefined ? 'null' : escapeSqlLiteral(value);
}

function buildSql(overrides, sourceBySlug) {
  const statements = [
    '-- Neutral Spanish overrides generated by scripts/seed/emit-neutral-spanish.mjs',
    '-- Idempotent and drift-safe: each UPDATE only fires while the live columns',
    '-- still equal the imported seed snapshot (`is not distinct from`), so a row',
    '-- edited after the import is skipped untouched instead of being reverted.',
    '-- Re-running the file changes nothing. Applying it is a manual decision.',
    '-- Apply:',
    '--   docker exec -i supabase-db psql -U postgres -d postgres < neutral-spanish.sql',
    'begin;',
  ];

  for (const [slug, override] of Object.entries(overrides)) {
    const source = sourceBySlug.get(slug);
    const sets = [];
    const guards = [];
    if (override.title !== undefined) {
      sets.push(`  title = ${escapeSqlLiteral(override.title)}`);
      guards.push(`    and title is not distinct from ${sqlNullableLiteral(source.title)}`);
    }
    if (override.description !== undefined) {
      sets.push(`  description = ${escapeSqlLiteral(override.description)}`);
      guards.push(
        `    and description is not distinct from ${sqlNullableLiteral(source.description)}`
      );
    }
    if (override.questions !== undefined) {
      const json = escapeSqlLiteral(JSON.stringify(override.questions));
      sets.push(`  questions = ${json}::jsonb`);
      const sourceJson = escapeSqlLiteral(JSON.stringify(source.questions));
      guards.push(`    and questions is not distinct from ${sourceJson}::jsonb`);
    }
    statements.push(
      [
        'update public.quizzes',
        'set',
        sets.join(',\n'),
        `where slug = ${escapeSqlLiteral(slug)}`,
        `${guards.join('\n')};`,
      ].join('\n')
    );
  }

  statements.push('commit;');
  return `${statements.join('\n\n')}\n`;
}

function main() {
  const write = process.argv.includes('--write');
  const dryRun = process.argv.includes('--dry-run');
  const inputIndex = process.argv.indexOf('--input');
  const inputArg = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (inputIndex !== -1 && (!inputArg || inputArg.startsWith('--'))) {
    console.error('--input needs a path, e.g. --input scripts/seed/neutral-spanish-overrides.json');
    process.exit(1);
  }
  const inputPath = inputArg ? resolve(inputArg) : OVERRIDES_PATH;

  const jsonText = readFileSync(inputPath, 'utf8');
  const duplicateSlugs = topLevelKeys(jsonText).filter(
    (key, index, keys) => keys.indexOf(key) !== index
  );
  if (duplicateSlugs.length > 0) {
    console.error(
      `${inputPath}: duplicate slugs ${[...new Set(duplicateSlugs)].join(', ')} — JSON.parse would silently drop the earlier overrides`
    );
    process.exit(1);
  }

  const parsed = JSON.parse(jsonText);
  const overrides = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  if (!overrides || Object.keys(overrides).length === 0) {
    console.error(`${inputPath}: expected a nonempty object map of slug -> override`);
    process.exit(1);
  }

  const sourceBySlug = loadSourceQuizzes();
  const errors = validate(overrides, sourceBySlug);
  if (errors.length > 0) {
    console.error(`Neutral-Spanish override validation failed (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const count = Object.keys(overrides).length;
  if (dryRun) {
    console.log(`Validated ${count} overrides; no SQL emitted.`);
    return;
  }

  const sql = buildSql(overrides, sourceBySlug);
  if (write) {
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, sql, 'utf8');
    console.log(`Wrote ${OUTPUT_PATH} (${count} quizzes)`);
  } else {
    process.stdout.write(sql);
  }
}

main();
