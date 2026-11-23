/**
 * Tests for the procedural cover SVG generator.
 *
 * Locks in the invariants that make /covers/[slug] safe to serve: every
 * interpolated string is XML-escaped, the output is deterministic, and the
 * quiz_type selects the theme defined in cover-system.ts.
 */

import { describe, expect, it } from 'vitest';
import { buildQuizCoverSvg } from '@/lib/design/cover-svg';
import { coverArtSpec, coverMotifMarkup } from '@/lib/design/franchise-palette';
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

  it('produces a different cover for a different quiz, tinted by its category', () => {
    const a = buildQuizCoverSvg(
      makeCoverQuiz({ title: 'Which Stranger Things character are you?' })
    );
    const b = buildQuizCoverSvg(makeCoverQuiz({ title: 'Random facts' }));

    expect(a).not.toBe(b);
    // movies-tv: acento de la paleta por franquicia.
    expect(a).toContain('#ff6b6b');
    expect(b).toContain('#ff6b6b');
  });

  it('shares the card rule: the same motif markup the card paints inline', () => {
    const quiz = { ...makeCoverQuiz(), slug: 'en-space-trivia' };
    const spec = coverArtSpec(
      { slug: quiz.slug, title: quiz.title, quizType: quiz.quiz_type, categorySlug: 'movies-tv' },
      'night'
    );
    expect(spec.motif).toBe('film');
    expect(buildQuizCoverSvg(quiz)).toContain(coverMotifMarkup(spec, 1600, 900));
  });

  it('art variant (stock fallback) is 3:2 and carries no title text', () => {
    const svg = buildQuizCoverSvg(
      { ...makeCoverQuiz({ title: '<b>Space</b> Trivia' }), slug: 'x' },
      'art'
    );

    expect(svg).toContain('viewBox="0 0 1200 800"');
    expect(svg).not.toContain('Space Trivia');
    expect(svg).not.toContain('>Space<');
    expect(svg).not.toContain('<b>');
    expect(svg).not.toContain('TRIVIA');
    // Solo la inicial como texto («Space» → S), nunca el «<» del marcado.
    expect(svg).toContain('>S</text>');
  });

  it('wraps a very long title with emojis into multiple tspans', () => {
    const title = `🎬 The extremely long quiz title that keeps going and going and going ${'🍿'.repeat(10)}`;
    const svg = buildQuizCoverSvg(makeCoverQuiz({ title: title.padEnd(90, 'x') }));

    const tspans = svg.match(/<tspan/g) ?? [];
    expect(tspans.length).toBeGreaterThanOrEqual(2);
    // A title that does not fit in three lines is marked as truncated.
    expect(tspans.length).toBe(3);
    expect(svg).toContain('…');
    expect(svg).toContain('</svg>');
  });

  it('builds a 840×1200 portrait variant for the OG result panel', () => {
    const svg = buildQuizCoverSvg(makeCoverQuiz(), 'portrait');

    expect(svg).toContain('width="840" height="1200"');
    expect(svg).toContain('viewBox="0 0 840 1200"');
    expect(svg).toContain('>TRIVIA<');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('escapes the title and category in the portrait variant too', () => {
    const svg = buildQuizCoverSvg(
      makeCoverQuiz({ title: `<script>alert(1)</script> & "quoted"` }),
      'portrait'
    );

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svg).toContain('MOVIES &amp; TV');
  });

  it('portrait and landscape are different documents for the same quiz', () => {
    expect(buildQuizCoverSvg(makeCoverQuiz(), 'portrait')).not.toBe(
      buildQuizCoverSvg(makeCoverQuiz())
    );
  });

  it('uses different themes and badges for trivia vs personality', () => {
    const trivia = buildQuizCoverSvg(makeCoverQuiz({ quiz_type: 'trivia' }));
    const personality = buildQuizCoverSvg(makeCoverQuiz({ quiz_type: 'personality' }));

    expect(trivia).toContain('>TRIVIA<');
    expect(personality).toContain('>PERSONALITY<');
    expect(trivia).not.toBe(personality);
  });
});
