// Runs under `node --test`. Vitest does not discover *.test.mjs (its include
// only covers .test.ts/.test.tsx), so this file is a plain Node test on purpose.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'seed', 'editorial-seed-2026b.json'), 'utf8')
);
const LOCALE_MAP = readFileSync(join(ROOT, 'src', 'lib', 'data', 'quiz-locale-map.ts'), 'utf8');

const CATEGORIES = ['science', 'technology', 'food-drink', 'animals', 'relationships'];

describe('editorial-seed-2026b', () => {
  it('contains exactly 10 quizzes', () => {
    assert.equal(seed.quizzes.length, 10);
  });

  it('has one en and one es quiz per thin category', () => {
    for (const category of CATEGORIES) {
      const group = seed.quizzes.filter((quiz) => quiz.category === category);
      assert.deepEqual(group.map((quiz) => quiz.language).sort(), ['en', 'es'], category);
    }
  });

  it('gives every quiz 8 questions of 4 options', () => {
    for (const quiz of seed.quizzes) {
      assert.equal(quiz.questions.length, 8, quiz.slug);
      for (const question of quiz.questions) {
        assert.equal(question.options.length, 4, `${quiz.slug} ${question.id}`);
      }
    }
  });

  it('marks exactly one option correct in every trivia question', () => {
    for (const quiz of seed.quizzes) {
      if (quiz.quiz_type !== 'trivia') continue;
      for (const question of quiz.questions) {
        const correct = question.options.filter((option) => option.is_correct === true);
        assert.equal(correct.length, 1, `${quiz.slug} ${question.id}`);
      }
    }
  });

  it('keeps descriptions between 80 and 158 characters', () => {
    for (const quiz of seed.quizzes) {
      const length = quiz.description.length;
      assert.ok(length >= 80 && length <= 158, `${quiz.slug}: ${length} chars`);
    }
  });

  it('links each en/es pair in the locale map', () => {
    for (const category of CATEGORIES) {
      const en = seed.quizzes.find((quiz) => quiz.category === category && quiz.language === 'en');
      const es = seed.quizzes.find((quiz) => quiz.category === category && quiz.language === 'es');
      assert.ok(
        LOCALE_MAP.includes(`'${en.slug}': '${es.slug}'`),
        `${en.slug} -> ${es.slug} missing from EN_TO_ES`
      );
    }
  });

  it('uses unique slugs that start with the language prefix', () => {
    const slugs = seed.quizzes.map((quiz) => quiz.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const quiz of seed.quizzes) {
      assert.ok(quiz.slug.startsWith(`${quiz.language}-`), quiz.slug);
    }
  });
});
