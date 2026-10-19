/**
 * Tests for the authoritative scorer (`src/lib/quiz/submission.ts`).
 *
 * The browser sends choices; this module is the only thing that decides what a
 * finished game is worth. These tests lock in the numbers that get persisted:
 * trivia scores on correctness, personality resolves a dominant tag, hostile or
 * malformed payloads cannot buy points, and `pointsFor` mirrors the
 * `award_quiz_points` trigger (10 + 25 for a perfect game).
 */

import { describe, expect, it } from 'vitest';
import {
  QuizAnswerSchema,
  QuizSubmissionSchema,
  pointsFor,
  scoreSubmission,
} from '@/lib/quiz/submission';
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
        options: [
          { id: 'q1a', text: 'Saturn', is_correct: true },
          { id: 'q1b', text: 'Mars' },
        ],
      },
      {
        id: 'q2',
        question: 'What is the Moon made of?',
        options: [
          { id: 'q2a', text: 'Rock', is_correct: true },
          { id: 'q2b', text: 'Cheese' },
        ],
      },
      {
        id: 'q3',
        question: 'Which planet is closest to the Sun?',
        options: [
          { id: 'q3a', text: 'Mercury', is_correct: true },
          { id: 'q3b', text: 'Venus' },
        ],
      },
    ],
    results: null,
    tags: ['space'],
    estimated_minutes: 2,
    plays_count: 0,
    shares_count: 0,
    avg_score: null,
    likes_count: 0,
    status: 'published',
    is_featured: false,
    is_ai_generated: false,
    published_at: '2026-05-21T00:00:00.000Z',
    updated_at: null,
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

function makePersonalityQuiz(): Quiz {
  return makeQuiz({
    quiz_type: 'personality',
    results: [
      { id: 'r-bold', title: 'The Bold One', description: 'Loud.', personality_tag: 'bold' },
      { id: 'r-calm', title: 'The Calm One', description: 'Steady.', personality_tag: 'calm' },
    ],
    questions: [
      {
        id: 'p1',
        question: 'Pick a Friday night',
        options: [
          { id: 'p1a', text: 'Books', personality_tags: ['calm'] },
          { id: 'p1b', text: 'Party', personality_tags: ['bold'] },
        ],
      },
      {
        id: 'p2',
        question: 'Pick a drink',
        options: [
          { id: 'p2a', text: 'Tea', personality_tags: ['calm'] },
          { id: 'p2b', text: 'Energy drink', personality_tags: ['bold'] },
        ],
      },
    ],
  });
}

describe('scoreSubmission — trivia', () => {
  it('counts only correct answers, with maxScore equal to the question count', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 800 },
      { question_id: 'q2', selected_option_id: 'q2b', time_ms: 900 },
      { question_id: 'q3', selected_option_id: 'q3a', time_ms: 1000 },
    ]);

    expect(scored.score).toBe(2);
    expect(scored.maxScore).toBe(3);
    expect(scored.percentage).toBe(67);
    expect(scored.perfect).toBe(false);
  });

  it('marks perfect only when every question is answered correctly', () => {
    const perfect = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 0 },
      { question_id: 'q2', selected_option_id: 'q2a', time_ms: 0 },
      { question_id: 'q3', selected_option_id: 'q3a', time_ms: 0 },
    ]);
    expect(perfect.score).toBe(3);
    expect(perfect.percentage).toBe(100);
    expect(perfect.perfect).toBe(true);

    const oneSkipped = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 0 },
      { question_id: 'q2', selected_option_id: 'q2a', time_ms: 0 },
      { question_id: 'q3', selected_option_id: '', time_ms: 0 },
    ]);
    expect(oneSkipped.perfect).toBe(false);
  });

  it('drops answers for questions that do not belong to the quiz', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 0 },
      { question_id: 'someone-elses-question', selected_option_id: 'x', time_ms: 0 },
    ]);

    expect(scored.graded).toHaveLength(1);
    expect(scored.score).toBe(1);
  });

  it('treats an invented selected_option_id as not correct', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'not-an-option', time_ms: 0 },
    ]);

    expect(scored.score).toBe(0);
    expect(scored.graded[0].is_correct).toBe(false);
  });

  it('keeps only the first answer when a question is answered twice', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1b', time_ms: 0 },
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 0 },
    ]);

    expect(scored.graded).toHaveLength(1);
    expect(scored.graded[0].selected_option_id).toBe('q1b');
    expect(scored.score).toBe(0);
  });

  it('records a skipped question as unanswered without breaking the count', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: '', time_ms: 0 },
      { question_id: 'q2', selected_option_id: 'q2a', time_ms: 0 },
    ]);

    expect(scored.graded).toHaveLength(2);
    expect(scored.graded[0]).toMatchObject({ question_id: 'q1', is_correct: false });
    expect(scored.score).toBe(1);
  });
});

describe('scoreSubmission — personality', () => {
  it('resolves the result from the dominant tag', () => {
    const scored = scoreSubmission(makePersonalityQuiz(), [
      { question_id: 'p1', selected_option_id: 'p1a', time_ms: 0 },
      { question_id: 'p2', selected_option_id: 'p2a', time_ms: 0 },
    ]);

    expect(scored.resultId).toBe('r-calm');
    expect(scored.resultTitle).toBe('The Calm One');
    // Completion is the pass: every graded answer counts toward the score.
    expect(scored.score).toBe(2);
    expect(scored.perfect).toBe(true);
  });

  it('breaks a tag tie by the tag seen first in the answers, not by results order', () => {
    // calm appears first in the answers even though r-bold is first in results.
    const scored = scoreSubmission(makePersonalityQuiz(), [
      { question_id: 'p1', selected_option_id: 'p1a', time_ms: 0 },
      { question_id: 'p2', selected_option_id: 'p2b', time_ms: 0 },
    ]);

    expect(scored.resultId).toBe('r-calm');
  });

  it('falls back to the first result when no tags were collected', () => {
    const scored = scoreSubmission(makePersonalityQuiz(), [
      { question_id: 'p1', selected_option_id: '', time_ms: 0 },
    ]);

    expect(scored.resultId).toBe('r-bold');
    // A skipped question still lands in `graded`, so it counts toward the score.
    expect(scored.score).toBe(1);
  });
});

describe('QuizSubmissionSchema', () => {
  const valid = {
    quizId: '123e4567-e89b-12d3-a456-426614174000',
    answers: [{ question_id: 'q1', selected_option_id: 'q1a' }],
  };

  it('accepts the minimal payload and applies the defaults', () => {
    const parsed = QuizSubmissionSchema.parse(valid);
    expect(parsed.answers[0].time_ms).toBe(0);
    expect(parsed.timeTakenSeconds).toBe(0);
  });

  it('rejects more than 50 answers', () => {
    const many = Array.from({ length: 51 }, (_, index) => ({
      question_id: `q${index}`,
      selected_option_id: 'a',
    }));
    expect(QuizSubmissionSchema.safeParse({ ...valid, answers: many }).success).toBe(false);
  });

  it('rejects out-of-range timings', () => {
    const tooSlow = {
      ...valid,
      answers: [{ question_id: 'q1', selected_option_id: 'a', time_ms: 30 * 60 * 1000 + 1 }],
    };
    expect(QuizSubmissionSchema.safeParse(tooSlow).success).toBe(false);
    expect(
      QuizSubmissionSchema.safeParse({ ...valid, timeTakenSeconds: 2 * 60 * 60 + 1 }).success
    ).toBe(false);
  });

  it('rejects an empty answers array', () => {
    expect(QuizSubmissionSchema.safeParse({ ...valid, answers: [] }).success).toBe(false);
  });
});

describe('QuizAnswerSchema', () => {
  it('defaults time_ms to 0 and rejects negative times', () => {
    expect(QuizAnswerSchema.parse({ question_id: 'q1', selected_option_id: 'a' }).time_ms).toBe(0);
    expect(
      QuizAnswerSchema.safeParse({ question_id: 'q1', selected_option_id: 'a', time_ms: -1 })
        .success
    ).toBe(false);
  });
});

describe('pointsFor', () => {
  it('matches the award_quiz_points trigger: 10 + 25 for a perfect game', () => {
    expect(pointsFor(true)).toBe(35);
    expect(pointsFor(false)).toBe(10);
  });
});
