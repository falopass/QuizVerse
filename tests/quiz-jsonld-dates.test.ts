/**
 * Tests for the Quiz JSON-LD dates: dateModified must reflect the real
 * `updated_at`, not duplicate `published_at`.
 */

import { describe, expect, it } from 'vitest';
import { quizNode } from '@/lib/seo/structured-data';
import type { Quiz } from '@/types/quiz';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    slug: 'space-trivia',
    title: 'Space Trivia',
    description: 'A trivia quiz about space.',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'Which planet has the most moons?',
        options: [{ id: 'q1a', text: 'Saturn', is_correct: true }],
      },
    ],
    results: null,
    tags: [],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: '2026-05-21T00:00:00.000Z',
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function nodeFor(quiz: Quiz) {
  return quizNode({
    quiz,
    locale: 'en',
    category: null,
    description: quiz.description ?? '',
    imageUrl: 'https://quizverse.org/og.png',
  });
}

describe('quizNode dates', () => {
  it('uses updated_at for dateModified when present', () => {
    const node = nodeFor(
      makeQuiz({
        published_at: '2026-05-21T00:00:00.000Z',
        updated_at: '2026-09-30T12:00:00.000Z',
      })
    );
    expect(node.datePublished).toBe('2026-05-21T00:00:00.000Z');
    expect(node.dateModified).toBe('2026-09-30T12:00:00.000Z');
  });

  it('falls back to published_at for dateModified when updated_at is null', () => {
    const node = nodeFor(makeQuiz({ updated_at: null }));
    expect(node.datePublished).toBe('2026-05-21T00:00:00.000Z');
    expect(node.dateModified).toBe('2026-05-21T00:00:00.000Z');
  });

  it('omits both keys when neither date exists', () => {
    const node = nodeFor(makeQuiz({ published_at: null, updated_at: null }));
    expect(node).not.toHaveProperty('datePublished');
    expect(node).not.toHaveProperty('dateModified');
  });
});
