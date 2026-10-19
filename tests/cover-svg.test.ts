/**
 * Tests for the procedural cover SVG generator.
 *
 * Locks in the invariants that make /covers/[slug] safe to serve: every
 * interpolated string is XML-escaped, the output is deterministic, and the
 * quiz_type selects the theme defined in cover-system.ts.
 */

import { describe, expect, it } from 'vitest';
import { buildQuizCoverSvg } from '@/lib/design/cover-svg';
import type { Category, Quiz } from '@/types/quiz';

type CoverQuiz = Pick<Quiz, 'title' | 'description' | 'quiz_type' | 'category'>;

const MOVIES_CATEGORY: Category = {
  id: 'cat-movies',
  name: 'Movies & TV',
  slug: 'movies-tv',
  description: null,
  icon: '🎬',
  color: null,
  gradient_from: null,
  gradient_to: null,
  quiz_count: 0,
  sort_order: 0,
};

function makeCoverQuiz(overrides: Partial<CoverQuiz> = {}): CoverQuiz {
  return {
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    quiz_type: 'trivia',
    category: MOVIES_CATEGORY,
    ...overrides,
  };
}

describe('buildQuizCoverSvg', () => {
  it('returns a valid SVG document', () => {
    const svg = buildQuizCoverSvg(makeCoverQuiz());

    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('escapes the title so raw markup never reaches the SVG', () => {
    const svg = buildQuizCoverSvg(
      makeCoverQuiz({ title: `<script>alert(1)</script> & "quoted" 'x'` })
    );

    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('</script>');
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;quoted&quot;');
    expect(svg).toContain('&apos;x&apos;');
  });

  it('escapes the category label as well', () => {
    const svg = buildQuizCoverSvg(makeCoverQuiz()); // category name: "Movies & TV"

    expect(svg).toContain('MOVIES &amp; TV');
  });

  it('is deterministic: same quiz, byte-identical SVG', () => {
    const quiz = makeCoverQuiz({ title: 'Which Stranger Things character are you?' });

    expect(buildQuizCoverSvg(quiz)).toBe(buildQuizCoverSvg(quiz));
  });

  it('produces a different cover for a different quiz (theme override)', () => {
    const strangerThings = buildQuizCoverSvg(
      makeCoverQuiz({ title: 'Which Stranger Things character are you?' })
    );
    const generic = buildQuizCoverSvg(makeCoverQuiz({ title: 'Random facts' }));

    expect(strangerThings).not.toBe(generic);
    expect(strangerThings).toContain('#a64c33'); // stranger-things base
    expect(generic).toContain('#2d5f9c'); // trivia base
  });

  it('wraps a very long title with emojis into multiple tspans', () => {
    const title = `🎬 The extremely long quiz title that keeps going and going and going ${'🍿'.repeat(10)}`;
    const svg = buildQuizCoverSvg(makeCoverQuiz({ title: title.padEnd(90, 'x') }));

    const tspans = svg.match(/<tspan/g) ?? [];
    expect(tspans.length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('</svg>');
  });

  it('uses different themes and badges for trivia vs personality', () => {
    const trivia = buildQuizCoverSvg(makeCoverQuiz({ quiz_type: 'trivia' }));
    const personality = buildQuizCoverSvg(makeCoverQuiz({ quiz_type: 'personality' }));

    expect(trivia).toContain('>TRIVIA<');
    expect(personality).toContain('>PERSONALITY<');
    expect(trivia).toContain('#2d5f9c');
    expect(personality).toContain('#bb5c35');
    expect(trivia).not.toBe(personality);
  });
});
