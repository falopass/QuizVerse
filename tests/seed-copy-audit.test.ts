import { describe, expect, it } from 'vitest';
import {
  auditLot,
  auditQuiz,
  flagDuplicateSlugs,
  formatReport,
} from '../scripts/seed/audit-copy.mjs';

const OK_TITLE = 'A Perfectly Fine Quiz Title Between Thirty And Sixty';
const OK_DESCRIPTION =
  'A perfectly fine description between eighty and one hundred fifty-eight characters, no more no less.';

function quiz(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'en-fine-quiz',
    title: OK_TITLE,
    description: OK_DESCRIPTION,
    questions: [{ question: 'A normal question?' }],
    ...overrides,
  };
}

describe('auditQuiz', () => {
  it('accepts a quiz within the copy rules', () => {
    expect(auditQuiz(quiz())).toEqual([]);
  });

  it('flags a title under 30 chars', () => {
    const v = auditQuiz(quiz({ title: 'Short Title' }));
    expect(v.map((x) => x.type)).toContain('title-length');
  });

  it('flags a title over 65 chars', () => {
    const v = auditQuiz(quiz({ title: 'T'.repeat(66) }));
    expect(v.map((x) => x.type)).toContain('title-length');
  });

  it('flags a description under 80 chars', () => {
    const v = auditQuiz(quiz({ description: 'Too short a description.' }));
    expect(v.map((x) => x.type)).toContain('description-length');
  });

  it('flags a description over 158 chars', () => {
    const v = auditQuiz(quiz({ description: 'D'.repeat(159) }));
    expect(v.map((x) => x.type)).toContain('description-length');
  });

  it.each([
    'Fan Trivia Challenge: The Movies',
    'Test Your Knowledge On Anime',
    '¿Cuánto sabes de fútbol?',
    'Pon a prueba tu memoria musical',
  ])('flags the template title %s', (title) => {
    const v = auditQuiz(quiz({ title }));
    expect(v.map((x) => x.type)).toContain('template-title');
  });

  it.each([
    { title: 'A title where you mirá the voseo hidden inside ok length' },
    { description: `${OK_DESCRIPTION} Andá, probá.` },
    { questions: [{ question: '¿Qué querés elegir hoy?' }] },
  ])('flags voseo', (patch) => {
    const v = auditQuiz(quiz(patch));
    expect(v.map((x) => x.type)).toContain('voseo');
  });
});

describe('auditLot + flagDuplicateSlugs', () => {
  it('flags a slug repeated across two lots', () => {
    const lotA = auditLot('a.json', { quizzes: [quiz({ slug: 'en-dup' })] });
    const lotB = auditLot('b.json', { quizzes: [quiz({ slug: 'en-dup' })] });
    flagDuplicateSlugs([lotA, lotB]);
    expect(lotA.violations.map((x) => x.type)).toContain('duplicate-slug');
    expect(lotB.violations.map((x) => x.type)).toContain('duplicate-slug');
  });

  it('does not flag slugs unique to their lot', () => {
    const lotA = auditLot('a.json', { quizzes: [quiz({ slug: 'en-one' })] });
    const lotB = auditLot('b.json', { quizzes: [quiz({ slug: 'en-two' })] });
    flagDuplicateSlugs([lotA, lotB]);
    expect(lotA.violations).toEqual([]);
    expect(lotB.violations).toEqual([]);
  });
});

describe('formatReport', () => {
  it('renders without throwing on empty lots', () => {
    const report = formatReport([auditLot('empty.json', { quizzes: [] })]);
    expect(report).toContain('TOTAL: 0 quizzes, 0 violations');
  });
});
