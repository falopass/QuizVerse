import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'seed', 'editorial-seed-2026b.json'), 'utf8')
);

const CATEGORIES = ['science', 'technology', 'food-drink', 'animals', 'relationships'];

describe('editorial-seed-2026b', () => {
  it('contains exactly 10 quizzes', () => {
    expect(seed.quizzes).toHaveLength(10);
  });

  it('has one en and one es quiz per thin category', () => {
    for (const category of CATEGORIES) {
      const group = seed.quizzes.filter((quiz) => quiz.category === category);
      expect(group.map((quiz) => quiz.language).sort()).toEqual(['en', 'es']);
    }
  });

  it('gives every quiz 8 questions of 4 options', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.questions).toHaveLength(8);
      for (const question of quiz.questions) {
        expect(question.options).toHaveLength(4);
      }
    }
  });

  it('marks exactly one option correct in every trivia question', () => {
    for (const quiz of seed.quizzes) {
      if (quiz.quiz_type !== 'trivia') continue;
      for (const question of quiz.questions) {
        expect(question.options.filter((option) => option.is_correct === true)).toHaveLength(1);
      }
    }
  });

  it('keeps descriptions between 80 and 158 characters', () => {
    for (const quiz of seed.quizzes) {
      expect(quiz.description.length).toBeGreaterThanOrEqual(80);
      expect(quiz.description.length).toBeLessThanOrEqual(158);
    }
  });

  it('uses unique slugs that start with the language prefix', () => {
    const slugs = seed.quizzes.map((quiz) => quiz.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const quiz of seed.quizzes) {
      expect(quiz.slug.startsWith(`${quiz.language}-`)).toBe(true);
    }
  });
});
