/**
 * Tests for the cover theme system: `inferVisualProfile` picks the visual
 * preset (and therefore the cover mode) and `getCoverTheme` merges the
 * matching palette over the per-quiz-type base theme.
 */

import { describe, expect, it } from 'vitest';
import { inferVisualProfile } from '@/lib/design/visual-profile';
import { getCoverTheme } from '@/lib/design/cover-system';
import type { Category, Quiz } from '@/types/quiz';

type VisualInput = Pick<
  Quiz,
  'title' | 'description' | 'quiz_type' | 'tags' | 'category' | 'language'
>;

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Movies & TV',
    slug: 'movies-tv',
    description: null,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 0,
    sort_order: 0,
    ...overrides,
  };
}

function makeInput(overrides: Partial<VisualInput> = {}): VisualInput {
  return {
    title: 'Generic Knowledge Quiz',
    description: 'Answer questions about general topics.',
    quiz_type: 'trivia',
    tags: [],
    category: null,
    language: 'en',
    ...overrides,
  };
}

describe('inferVisualProfile', () => {
  it('matches a preset by title and enables stock covers', () => {
    const profile = inferVisualProfile(
      makeInput({ title: 'Which Stranger Things character are you?' })
    );

    expect(profile.cover_mode).toBe('stock');
    expect(profile.theme_key).toBe('stranger-things');
    expect(profile.theme_key).not.toBe('generic-trivia');
    expect(profile.theme_key).not.toBe('generic-personality');
  });

  it('matches a preset by tags even when the title is generic', () => {
    const profile = inferVisualProfile(makeInput({ tags: ['space opera', 'jedi'] }));

    expect(profile.cover_mode).toBe('stock');
    expect(profile.theme_key).toBe('star-wars');
  });

  it('matches a preset by category name and slug', () => {
    const byName = inferVisualProfile(
      makeInput({ category: makeCategory({ name: 'Stand-up Comedy' }) })
    );
    expect(byName.theme_key).toBe('hacks');
    expect(byName.cover_mode).toBe('stock');

    const bySlug = inferVisualProfile(
      makeInput({
        category: makeCategory({ name: 'Anything', slug: 'euphoria-fans' }),
      })
    );
    expect(bySlug.theme_key).toBe('euphoria');
    expect(bySlug.cover_mode).toBe('stock');
  });

  it('matches a preset by description', () => {
    const profile = inferVisualProfile(
      makeInput({ description: 'A quiz set in Hawkins during the 80s.' })
    );

    expect(profile.theme_key).toBe('stranger-things');
    expect(profile.cover_mode).toBe('stock');
  });

  it('falls back to the generic preset and procedural covers without a match', () => {
    const profile = inferVisualProfile(makeInput());

    expect(profile.cover_mode).toBe('procedural');
    expect(profile.theme_key).toBe('generic-trivia');
  });

  it('falls back to the generic personality preset for personality quizzes', () => {
    const profile = inferVisualProfile(
      makeInput({ quiz_type: 'personality', title: 'What is your aura?' })
    );

    expect(profile.cover_mode).toBe('procedural');
    expect(profile.theme_key).toBe('generic-personality');
  });

  it('uses the lifestyle generic preset for personality quizzes in lifestyle', () => {
    const profile = inferVisualProfile(
      makeInput({
        quiz_type: 'personality',
        category: makeCategory({ name: 'Lifestyle', slug: 'lifestyle' }),
      })
    );

    expect(profile.cover_mode).toBe('procedural');
    expect(profile.theme_key).toBe('generic-lifestyle');
  });

  it('never throws on weird input', () => {
    expect(() =>
      inferVisualProfile(makeInput({ title: '', description: null, tags: [], category: null }))
    ).not.toThrow();
    expect(() => inferVisualProfile(makeInput({ title: '🎃👻✨', tags: ['🕹️'] }))).not.toThrow();

    const profile = inferVisualProfile(makeInput({ title: '🎃👻✨' }));
    expect(profile.cover_mode).toBe('procedural');
  });

  it('localizes the cover prompt and always returns search terms', () => {
    const en = inferVisualProfile(makeInput({ title: 'Stranger Things trivia', language: 'en' }));
    const es = inferVisualProfile(makeInput({ title: 'Stranger Things trivia', language: 'es' }));

    expect(en.cover_prompt).not.toBe(es.cover_prompt);
    expect(en.cover_search_terms.length).toBeGreaterThan(0);

    const fallbackEn = inferVisualProfile(makeInput({ language: 'en' }));
    const fallbackEs = inferVisualProfile(makeInput({ language: 'es' }));
    expect(fallbackEn.cover_prompt).not.toBe(fallbackEs.cover_prompt);
    expect(fallbackEs.cover_search_terms.length).toBeGreaterThan(0);
  });
});

describe('getCoverTheme', () => {
  it('differs between trivia and personality base themes', () => {
    const trivia = getCoverTheme(makeInput({ quiz_type: 'trivia' }));
    const personality = getCoverTheme(makeInput({ quiz_type: 'personality' }));

    expect(trivia.base).not.toBe(personality.base);
    expect(trivia).not.toEqual(personality);
  });

  it('merges the preset palette over the base theme for matched quizzes', () => {
    const base = getCoverTheme(makeInput());
    const themed = getCoverTheme(makeInput({ title: 'Which Stranger Things character are you?' }));

    // Overridden fields come from the stranger-things palette.
    expect(themed.base).toBe('#a64c33');
    expect(themed.base).not.toBe(base.base);
    // Non-overridden fields keep the trivia base.
    expect(themed.shell).toBe(base.shell);
    expect(themed.accent).toBe(base.accent);
    expect(themed.orb).toBe(base.orb);
  });

  it('is deterministic for the same input', () => {
    const input = makeInput({ title: 'Stranger Things trivia' });

    expect(getCoverTheme(input)).toEqual(getCoverTheme(input));
    expect(getCoverTheme(makeInput())).toEqual(getCoverTheme(makeInput()));
  });
});
