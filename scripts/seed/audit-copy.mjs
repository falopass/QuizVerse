#!/usr/bin/env node
/**
 * Copy audit — measures the editorial copy rules from docs/contenido.md
 * across every seed batch (scripts/seed/editorial-seed*.json).
 *
 * Reported per quiz:
 *   - title-length:      title outside 30-65 characters
 *   - description-length: description outside 80-158 characters
 *   - template-title:    title matching a generic template
 *   - voseo:             voseo in title, description or questions
 *   - duplicate-slug:    slug repeated across batch files
 *
 *   node scripts/seed/audit-copy.mjs           report only, always exit 0
 *   node scripts/seed/audit-copy.mjs --strict  exit 1 when violations exist
 *
 * Default mode reports without blocking: the current catalogue already has
 * violations and this tool measures them, it does not gate the pipeline.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED_DIR = dirname(fileURLToPath(import.meta.url));

const TITLE_MIN = 30;
const TITLE_MAX = 65;
const DESCRIPTION_MIN = 80;
const DESCRIPTION_MAX = 158;

const TEMPLATE_PATTERNS = [
  /Fan Trivia Challenge/i,
  /Test Your Knowledge/i,
  /How Deep Does Your/i,
  /¿Cuánto sabes/i,
  /Pon a prueba tu/i,
];

// \b no sirve aquí: \w excluye vocales acentuadas, así que «mirá» o «andá»
// no tendrían borde de palabra al final. Lookarounds con letras españolas.
const VOSEO =
  /(?<![a-záéíóúñü])(?:vos|vosotros|vosotras|tenés|podés|querés|sabés|hacés|decís|venís|salís|andá|mirá|fijate|poné|sacá|elegí|jugá|probá|usá)(?![a-záéíóúñü])/iu;

/** Audit a single quiz; returns a list of { type, detail } violations. */
export function auditQuiz(quiz) {
  const violations = [];
  const title = quiz.title ?? '';
  const description = quiz.description ?? '';

  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    violations.push({ type: 'title-length', detail: `title is ${title.length} chars` });
  }
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    violations.push({
      type: 'description-length',
      detail: `description is ${description.length} chars`,
    });
  }
  if (TEMPLATE_PATTERNS.some((pattern) => pattern.test(title))) {
    violations.push({ type: 'template-title', detail: `title matches a template` });
  }

  const texts = [title, description, ...(quiz.questions ?? []).map((q) => q.question ?? '')];
  const hit = texts.find((text) => VOSEO.test(text));
  if (hit !== undefined) {
    violations.push({ type: 'voseo', detail: `voseo in "${hit.slice(0, 60)}"` });
  }

  return violations;
}

/**
 * Audit one batch: { file, quizzes, violations, slugCounts }.
 * violations is a list of { slug, type, detail }.
 */
export function auditLot(file, data) {
  const quizzes = data.quizzes ?? [];
  const violations = [];
  const slugCounts = {};
  for (const quiz of quizzes) {
    slugCounts[quiz.slug] = (slugCounts[quiz.slug] ?? 0) + 1;
    for (const violation of auditQuiz(quiz)) {
      violations.push({ slug: quiz.slug, ...violation });
    }
  }
  return { file, quizzes, violations, slugCounts };
}

/** Mark slugs repeated across lots as duplicate-slug violations. */
export function flagDuplicateSlugs(lots) {
  const global = {};
  for (const lot of lots) {
    for (const slug of Object.keys(lot.slugCounts)) {
      global[slug] = (global[slug] ?? 0) + lot.slugCounts[slug];
    }
  }
  for (const lot of lots) {
    for (const slug of Object.keys(lot.slugCounts)) {
      if (global[slug] > 1) {
        lot.violations.push({
          slug,
          type: 'duplicate-slug',
          detail: `slug appears ${global[slug]} times across batches`,
        });
      }
    }
  }
}

/** Render the per-file summary and totals as printable lines. */
export function formatReport(lots) {
  const lines = [];
  let totalQuizzes = 0;
  let totalViolations = 0;

  for (const lot of lots) {
    totalQuizzes += lot.quizzes.length;
    totalViolations += lot.violations.length;

    const byType = {};
    for (const v of lot.violations) {
      byType[v.type] = (byType[v.type] ?? 0) + 1;
    }
    const summary =
      Object.entries(byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ') || 'clean';

    lines.push(
      `${lot.file}: ${lot.quizzes.length} quizzes, ${lot.violations.length} violations (${summary})`
    );
    for (const v of lot.violations.slice(0, 3)) {
      lines.push(`  ${v.slug} [${v.type}] ${v.detail}`);
    }
  }

  lines.push(`TOTAL: ${totalQuizzes} quizzes, ${totalViolations} violations`);
  return lines.join('\n');
}

function main() {
  const files = readdirSync(SEED_DIR)
    .filter((name) => /^editorial-seed.*\.json$/.test(name))
    .sort();

  const lots = files.map((file) =>
    auditLot(file, JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')))
  );
  flagDuplicateSlugs(lots);
  console.log(formatReport(lots));

  if (process.argv.includes('--strict') && lots.some((lot) => lot.violations.length > 0)) {
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
