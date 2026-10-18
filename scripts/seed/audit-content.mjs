#!/usr/bin/env node
/**
 * Content audit — the gate that decides whether the catalogue is publishable.
 *
 * Reads the JSON produced by supabase/seed/audit-export.sql and reports:
 * taxonomy coverage, placeholders, answer-key integrity and thin content.
 * Exits non-zero when a blocking problem is found, so it can run in CI.
 *
 *   node scripts/seed/audit-content.mjs
 *   node scripts/seed/audit-content.mjs --input <file> --json
 *
 * Blocking issues (exit 1):
 *   - a trivia question without exactly one correct option
 *   - an option with no text
 *   - a quiz without questions
 *   - a duplicate slug
 *
 * Reported but not blocking: thin descriptions, missing covers, empty categories.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_INPUT = join(ROOT, 'generated', 'audit', 'quizzes-audit-export.json');
const OUTPUT_DIR = join(ROOT, 'generated', 'audit');

/** Titles that signal a placeholder instead of a written quiz. */
const PLACEHOLDER_PATTERNS = [
  /^untitled/i,
  /\blorem\b/i,
  /\bplaceholder\b/i,
  /\btest quiz\b/i,
  /\bquiz \d+$/i,
  /\basdf\b/i,
  /^quiz$/i,
];

const MIN_DESCRIPTION = 60;
const MIN_QUESTIONS = 5;

const EXPECTED_CATEGORIES = [
  'anime-manga',
  'animals',
  'culture',
  'food-drink',
  'gaming',
  'geography',
  'history',
  'literature',
  'lifestyle',
  'movies-tv',
  'music',
  'pop-culture',
  'relationships',
  'science',
  'sports',
  'technology',
];

function countBy(rows, key) {
  return rows.reduce((accumulator, row) => {
    const value = row[key] ?? 'none';
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const inputPath = inputIndex !== -1 ? args[inputIndex + 1] : DEFAULT_INPUT;
  const asJson = args.includes('--json');

  const rows = JSON.parse(readFileSync(inputPath, 'utf8'));

  const blocking = [];
  const warnings = [];

  const slugCounts = countBy(rows, 'slug');
  for (const [slug, count] of Object.entries(slugCounts)) {
    if (count > 1) blocking.push(`duplicate slug: ${slug} (${count} rows)`);
  }

  for (const row of rows) {
    if (!row.question_count || row.question_count < 1) {
      blocking.push(`${row.slug}: no questions`);
    }
    if (row.trivia_questions_without_single_answer > 0) {
      blocking.push(
        `${row.slug}: ${row.trivia_questions_without_single_answer} trivia question(s) without exactly one correct option`
      );
    }
    if (row.empty_options > 0) {
      blocking.push(`${row.slug}: ${row.empty_options} option(s) with no text`);
    }

    if (row.question_count < MIN_QUESTIONS) {
      warnings.push(`${row.slug}: only ${row.question_count} questions`);
    }
    if (row.description_length < MIN_DESCRIPTION) {
      warnings.push(`${row.slug}: description is ${row.description_length} chars`);
    }
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(row.title))) {
      warnings.push(`${row.slug}: placeholder-looking title "${row.title}"`);
    }
    if (!row.has_cover) {
      warnings.push(`${row.slug}: no cover image (procedural cover will be used)`);
    }
  }

  const byCategory = countBy(rows, 'category');
  const emptyCategories = EXPECTED_CATEGORIES.filter((category) => !byCategory[category]);
  const byLanguage = countBy(rows, 'language');
  const byType = countBy(rows, 'quiz_type');

  const report = {
    generatedAt: new Date().toISOString(),
    input: inputPath.replace(ROOT, '.'),
    totals: {
      quizzes: rows.length,
      questions: rows.reduce((sum, row) => sum + (row.question_count ?? 0), 0),
      byLanguage,
      byType,
      byCategory,
    },
    emptyCategories,
    blocking,
    warnings,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, 'content-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Quizzes: ${rows.length}  Questions: ${report.totals.questions}`);
    console.log('By category:');
    for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${category.padEnd(16)} ${String(count).padStart(4)}`);
    }
    console.log(
      `Empty categories: ${emptyCategories.length === 0 ? 'none' : emptyCategories.join(', ')}`
    );
    console.log(`Blocking issues: ${blocking.length}`);
    for (const issue of blocking.slice(0, 20)) console.log(`  ✗ ${issue}`);
    console.log(`Warnings: ${warnings.length}`);
    const grouped = warnings.reduce((accumulator, warning) => {
      const key = warning.split(': ')[1]?.split(' ')[0] ?? warning;
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
    for (const [kind, count] of Object.entries(grouped)) console.log(`  ! ${kind}: ${count}`);
    console.log('Report: generated/audit/content-audit.json');
  }

  if (blocking.length > 0) process.exit(1);
}

main();
