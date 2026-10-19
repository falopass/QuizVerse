import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', 'scripts', 'seed', 'audit-content.mjs');
const REPORT = join(__dirname, '..', 'generated', 'audit', 'content-audit.json');

interface AuditRow {
  slug: string;
  title: string;
  question_count: number;
  description_length: number;
  has_cover: boolean;
  category: string;
  language: string;
  quiz_type: string;
  trivia_questions_without_single_answer: number;
  empty_options: number;
}

function validRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    slug: 'capitals-of-europe',
    title: 'Capitals of Europe',
    question_count: 5,
    description_length: 80,
    has_cover: true,
    category: 'geography',
    language: 'en',
    quiz_type: 'trivia',
    trivia_questions_without_single_answer: 0,
    empty_options: 0,
    ...overrides,
  };
}

interface AuditReport {
  totals: { quizzes: number; questions: number };
  blocking: string[];
  warnings: string[];
}

function runAudit(rows: AuditRow[]): { status: number; report: AuditReport; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'seed-audit-'));
  const fixture = join(dir, 'input.json');
  writeFileSync(fixture, JSON.stringify(rows));
  try {
    const stdout = execFileSync('node', [SCRIPT, '--input', fixture, '--json'], {
      encoding: 'utf8',
    });
    return { status: 0, report: JSON.parse(stdout), stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return {
      status: failure.status ?? -1,
      report: JSON.parse(failure.stdout ?? 'null'),
      stdout: failure.stdout ?? '',
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('scripts/seed/audit-content.mjs', () => {
  let originalReport: string;

  beforeAll(() => {
    originalReport = readFileSync(REPORT, 'utf8');
  });

  afterAll(() => {
    // The script always rewrites generated/audit/content-audit.json (tracked);
    // restore it so the working tree stays clean.
    writeFileSync(REPORT, originalReport);
  });

  it('exits 0 for a publishable catalogue', () => {
    const { status, report } = runAudit([
      validRow(),
      validRow({
        slug: 'which-element-are-you',
        title: 'Which element are you?',
        quiz_type: 'personality',
        category: 'lifestyle',
        language: 'es',
      }),
    ]);
    expect(status).toBe(0);
    expect(report.blocking).toEqual([]);
    expect(report.totals.quizzes).toBe(2);
  });

  it('blocks a trivia question without exactly one correct option', () => {
    const { status, report } = runAudit([validRow({ trivia_questions_without_single_answer: 2 })]);
    expect(status).toBe(1);
    expect(report.blocking).toEqual([
      'capitals-of-europe: 2 trivia question(s) without exactly one correct option',
    ]);
  });

  it('blocks an option with no text', () => {
    const { status, report } = runAudit([validRow({ empty_options: 1 })]);
    expect(status).toBe(1);
    expect(report.blocking).toEqual(['capitals-of-europe: 1 option(s) with no text']);
  });

  it('blocks a quiz without questions', () => {
    const { status, report } = runAudit([validRow({ question_count: 0 })]);
    expect(status).toBe(1);
    expect(report.blocking).toEqual(['capitals-of-europe: no questions']);
  });

  it('blocks duplicate slugs', () => {
    const { status, report } = runAudit([validRow(), validRow({ title: 'Duplicate' })]);
    expect(status).toBe(1);
    expect(report.blocking).toEqual(['duplicate slug: capitals-of-europe (2 rows)']);
  });

  it('prints a parseable JSON summary with --json even when blocking', () => {
    const { status, report, stdout } = runAudit([validRow({ empty_options: 3 })]);
    expect(status).toBe(1);
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(report.totals).toMatchObject({ quizzes: 1, questions: 5 });
    expect(report.blocking[0]).toContain('capitals-of-europe');
  });
});
