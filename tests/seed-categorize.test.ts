/**
 * Tests for the seed-pipeline category rules (scripts/seed/categorize-quizzes.mjs).
 *
 * The catalogue's taxonomy depends on an ordered rule table: franchises first,
 * then topics, then themes, with `culture` as the fallback. These tests lock in
 * the ordering so a misplaced rule breaks CI instead of silently re-categorizing
 * hundreds of quizzes on the next seed batch.
 *
 * The script is exercised as a subprocess (`node categorize-quizzes.mjs --input
 * <fixture>`) because vitest's transform cannot parse the .mjs source, and the
 * script already exports its behavior through stdout plus the report it writes.
 * `generated/audit/category-report.json` is a tracked pipeline artifact, so the
 * test restores whatever was there before it ran.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'categorize-quizzes.mjs');
const REPORT = join(__dirname, '..', 'generated', 'audit', 'category-report.json');

interface SeedQuiz {
  id: string;
  slug: string;
  title: string;
  tags?: string[];
  quiz_type?: string;
  language?: string;
  category?: string;
  excerpt?: string;
}

let fixtureDir: string;
let previousReport: string | null;

/** Runs the script on a fixture and returns stdout plus the report it wrote. */
function categorize(quizzes: SeedQuiz[]) {
  const input = join(fixtureDir, `input-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(input, JSON.stringify(quizzes));
  const stdout = execFileSync(process.execPath, [SCRIPT, '--input', input], {
    encoding: 'utf8',
  });
  const report = JSON.parse(readFileSync(REPORT, 'utf8')) as {
    total: number;
    byCategory: Record<string, number>;
    samples: Record<string, { title: string; why: string }[]>;
  };
  return { stdout, report };
}

function quiz(id: string, overrides: Partial<SeedQuiz> = {}): SeedQuiz {
  return {
    id,
    slug: `quiz-${id}`,
    title: 'Sample Quiz',
    language: 'en',
    ...overrides,
  };
}

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'seed-categorize-'));
  previousReport = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : null;
});

afterAll(() => {
  if (previousReport === null) {
    rmSync(REPORT, { force: true });
  } else {
    writeFileSync(REPORT, previousReport);
  }
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe('categorize-quizzes.mjs', () => {
  it('maps an anime franchise in the title to anime-manga even when tags suggest culture', () => {
    const { report } = categorize([
      quiz('a1', { title: 'Which Attack on Titan Character Are You?', tags: ['culture'] }),
    ]);
    expect(report.total).toBe(1);
    expect(report.byCategory['anime-manga']).toBe(1);
    expect(report.byCategory['culture']).toBeUndefined();
  });

  it('maps a quiz tagged as gaming to gaming', () => {
    const { report, stdout } = categorize([
      quiz('g1', { title: 'How Many Hours Have You Sunk Into This?', tags: ['gaming'] }),
    ]);
    expect(report.byCategory['gaming']).toBe(1);
    expect(stdout).toContain('gaming');
  });

  it('falls back to culture with a non-empty why when nothing matches', () => {
    const { report } = categorize([
      quiz('c1', { title: 'A Quiz About Totally Generic Things', tags: ['misc'] }),
    ]);
    expect(report.byCategory['culture']).toBe(1);
    expect(report.samples['culture'][0].why).toBeTruthy();
  });

  it('prefers anime-manga over gaming when both signals are present', () => {
    // Franchises are evaluated before topics (ORDERED_RULES / PRIORITY):
    // "zelda" alone would be gaming, but the anime franchise wins.
    const { report } = categorize([
      quiz('x1', { title: 'Naruto Fans Also Love Zelda', tags: ['gaming'] }),
    ]);
    expect(report.byCategory['anime-manga']).toBe(1);
    expect(report.byCategory['gaming']).toBeUndefined();
  });

  it('is deterministic: the same input always yields the same result', () => {
    const input = [
      quiz('d1', {
        title: 'Test Your Knowledge of the Solar System and Mars',
        tags: ['space', 'trivia'],
        excerpt: 'Planets, NASA missions and more.',
      }),
    ];
    const first = categorize(input);
    const second = categorize(input);
    expect(second.report.byCategory).toEqual(first.report.byCategory);
    expect(second.stdout).toBe(first.stdout);
  });

  it('resolves competing topic categories by PRIORITY order', () => {
    // Pair under test: music (PRIORITY index 3) vs science (index 8).
    // "album" matches music, "nasa"/"mars" match science; music must win
    // because it sits earlier in PRIORITY.
    const { report } = categorize([
      quiz('m1', {
        title: 'Which Album Should Soundtrack Your Trip to Mars?',
        tags: ['nasa'],
      }),
    ]);
    expect(report.byCategory['music']).toBe(1);
    expect(report.byCategory['science']).toBeUndefined();
  });
});
