import { describe, expect, it } from 'vitest';

import {
  normalizeCategory,
  normalizeGameSession,
  normalizeQuiz,
  parseAnswers,
  parseQuestions,
  parseResults,
  type CategoryRow,
  type GameSessionRow,
  type QuizRow,
} from '@/lib/data/normalizers';
import type { Category, Profile } from '@/types/quiz';

function categoryRow(overrides: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'cat-1',
    name: 'Culture',
    slug: 'culture',
    description: 'General culture',
    icon: 'globe',
    color: '#ff0000',
    gradient_from: '#ff0000',
    gradient_to: '#0000ff',
    quiz_count: 20,
    sort_order: 3,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function quizRow(overrides: Partial<QuizRow> = {}): QuizRow {
  return {
    id: 'q-1',
    creator_id: null,
    category_id: 'cat-1',
    title: 'Quiz One',
    slug: 'quiz-one',
    description: 'A quiz',
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: 'medium',
    language: 'en',
    questions: [
      {
        id: 'qn-1',
        text: 'Q?',
        options: [{ id: 'o-1', text: 'A', is_correct: true }],
      },
    ],
    results: null,
    tags: ['culture'],
    estimated_minutes: 5,
    question_count: 1,
    plays_count: 10,
    shares_count: 2,
    avg_score: 7.5,
    likes_count: 3,
    status: 'published',
    is_featured: false,
    is_ai_generated: true,
    featured_at: null,
    published_at: '2026-01-02T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function sessionRow(overrides: Partial<GameSessionRow> = {}): GameSessionRow {
  return {
    id: 'gs-1',
    quiz_id: 'q-1',
    player_id: 'u-1',
    score: 8,
    max_score: 10,
    percentage: 0,
    result_id: null,
    result_title: null,
    time_taken_seconds: 42,
    answers: [{ question_id: 'qn-1', option_id: 'o-1', is_correct: true }],
    share_token: 'tok-1',
    was_shared: false,
    completed_at: '2026-01-03T00:00:00Z',
    ...overrides,
  };
}

const creator: Profile = {
  id: 'u-1',
  username: 'diego',
  display_name: 'Diego',
  avatar_url: null,
  bio: null,
  points: 0,
  quizzes_played: 0,
  quizzes_created: 1,
  is_admin: false,
  is_verified: false,
  preferred_language: 'es',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('parseQuestions', () => {
  it('returns the array as-is when the column is an array', () => {
    const questions = [{ id: 'qn-1' }];
    expect(parseQuestions(questions)).toEqual(questions);
  });

  it.each([null, {}, 'not-json', 42, undefined])(
    'returns [] for non-array input: %s',
    (input) => {
      expect(parseQuestions(input as QuizRow['questions'])).toEqual([]);
    }
  );
});

describe('parseResults', () => {
  it('returns the array when the column is an array', () => {
    const results = [{ id: 'r-1', title: 'Winner' }];
    expect(parseResults(results)).toEqual(results);
  });

  it.each([null, {}, 'junk', 7])('returns null for non-array input: %s', (input) => {
    expect(parseResults(input as QuizRow['results'])).toBeNull();
  });
});

describe('parseAnswers', () => {
  it('returns the array when the column is an array', () => {
    const answers = [{ question_id: 'qn-1', option_id: 'o-1' }];
    expect(parseAnswers(answers)).toEqual(answers);
  });

  it.each([null, {}, 'junk', 7])('returns null for non-array input: %s', (input) => {
    expect(parseAnswers(input as GameSessionRow['answers'])).toBeNull();
  });
});

describe('normalizeCategory', () => {
  it('maps all nine public fields', () => {
    expect(normalizeCategory(categoryRow())).toEqual({
      id: 'cat-1',
      name: 'Culture',
      slug: 'culture',
      description: 'General culture',
      icon: 'globe',
      color: '#ff0000',
      gradient_from: '#ff0000',
      gradient_to: '#0000ff',
      quiz_count: 20,
      sort_order: 3,
    });
  });
});

describe('normalizeQuiz', () => {
  const categories = new Map<string, Category>([
    ['cat-1', normalizeCategory(categoryRow())],
  ]);

  it('resolves category via category_id and maps scalar fields', () => {
    const quiz = normalizeQuiz(quizRow(), categories, creator, false);
    expect(quiz.id).toBe('q-1');
    expect(quiz.slug).toBe('quiz-one');
    expect(quiz.category?.slug).toBe('culture');
    expect(quiz.creator).toEqual(creator);
    expect(quiz.questions).toHaveLength(1);
  });

  it('leaves category null without category_id', () => {
    const quiz = normalizeQuiz(quizRow({ category_id: null }), categories, creator, false);
    expect(quiz.category).toBeNull();
  });

  it('leaves category null when the id is not in the map', () => {
    const quiz = normalizeQuiz(quizRow({ category_id: 'missing' }), categories, creator, false);
    expect(quiz.category).toBeNull();
  });

  it('leaves creator null when none is passed', () => {
    expect(normalizeQuiz(quizRow(), categories, null, false).creator).toBeNull();
  });

  it('does not add visual_profile when enrichVisual is false', () => {
    const quiz = normalizeQuiz(quizRow(), categories, creator, false);
    expect(quiz.visual_profile).toBeUndefined();
  });

  it('adds visual_profile by default', () => {
    const quiz = normalizeQuiz(quizRow(), categories, creator);
    expect(quiz.visual_profile).toBeDefined();
  });

  it('degrades bad questions/results columns without throwing', () => {
    const quiz = normalizeQuiz(
      quizRow({ questions: { broken: true }, results: 'junk' }),
      categories,
      creator,
      false
    );
    expect(quiz.questions).toEqual([]);
    expect(quiz.results).toBeNull();
  });
});

describe('normalizeGameSession', () => {
  it('computes percentage from score/max_score and parses answers', () => {
    const session = normalizeGameSession(sessionRow({ percentage: 999 }));
    expect(session.percentage).toBe(80);
    expect(session.answers).toHaveLength(1);
    expect(session.share_token).toBe('tok-1');
  });

  it('returns percentage 0 when max_score is 0', () => {
    expect(normalizeGameSession(sessionRow({ score: 0, max_score: 0 })).percentage).toBe(0);
  });

  it('degrades non-array answers to null', () => {
    expect(normalizeGameSession(sessionRow({ answers: { bad: 1 } })).answers).toBeNull();
  });
});
