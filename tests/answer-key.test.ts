/**
 * Tests for the server-side answer key.
 *
 * These lock in the invariants that make the game honest: the browser never
 * receives `is_correct`, a crafted submission cannot buy points, and skipping a
 * question counts as unanswered.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildReview,
  eliminateWrongOptions,
  evaluateAnswer,
  toClientQuiz,
} from '@/lib/quiz/answer-key';
import { QuizSubmissionSchema, pointsFor, scoreSubmission } from '@/lib/quiz/submission';
import { generateUniqueSlug, slugifyTitle } from '@/lib/quiz/quiz-slug';
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
          { id: 'q1c', text: 'Venus' },
          { id: 'q1d', text: 'Mercury' },
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
    created_at: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('toClientQuiz', () => {
  it('strips the answer key from every option', () => {
    const client = toClientQuiz(makeQuiz());
    const leaked = client.questions.flatMap((question) =>
      question.options.filter((option) => 'is_correct' in option)
    );

    expect(leaked).toHaveLength(0);
    expect(JSON.stringify(client)).not.toContain('is_correct');
  });

  it('keeps everything the screens render', () => {
    const quiz = makeQuiz();
    const client = toClientQuiz(quiz);

    expect(client.title).toBe(quiz.title);
    expect(client.questions).toHaveLength(quiz.questions.length);
    expect(client.questions[0].options[0].text).toBe('Saturn');
  });

  it('does not mutate the source quiz', () => {
    const quiz = makeQuiz();
    toClientQuiz(quiz);
    expect(quiz.questions[0].options[0].is_correct).toBe(true);
  });
});

describe('evaluateAnswer', () => {
  it('grades against the stored key', () => {
    const quiz = makeQuiz();
    expect(evaluateAnswer(quiz, 'q1', 'q1a')).toMatchObject({
      isCorrect: true,
      correctOptionId: 'q1a',
    });
    expect(evaluateAnswer(quiz, 'q1', 'q1b')).toMatchObject({
      isCorrect: false,
      correctOptionId: 'q1a',
    });
  });

  it('rejects questions that are not part of the quiz', () => {
    expect(evaluateAnswer(makeQuiz(), 'nope', 'q1a')).toBeNull();
  });

  it('treats an unknown option as wrong but still reveals the right one', () => {
    expect(evaluateAnswer(makeQuiz(), 'q2', 'made-up')).toMatchObject({
      isCorrect: false,
      correctOptionId: 'q2a',
    });
  });
});

describe('eliminateWrongOptions', () => {
  it('only removes options that are not correct', () => {
    const eliminated = eliminateWrongOptions(makeQuiz(), 'q1');
    expect(eliminated).toHaveLength(2);
    expect(eliminated).not.toContain('q1a');
  });

  it('is deterministic so refreshing cannot reroll a better hint', () => {
    const first = eliminateWrongOptions(makeQuiz(), 'q1');
    const second = eliminateWrongOptions(makeQuiz(), 'q1');
    expect(first).toEqual(second);
  });

  it('returns nothing when there is not enough to hide', () => {
    expect(eliminateWrongOptions(makeQuiz(), 'q2')).toEqual([]);
  });
});

describe('scoreSubmission', () => {
  it('scores trivia from the database, not from the payload', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 1000 },
      { question_id: 'q2', selected_option_id: 'q2b', time_ms: 1000 },
    ]);

    expect(scored.score).toBe(1);
    expect(scored.maxScore).toBe(2);
    expect(scored.percentage).toBe(50);
    expect(scored.perfect).toBe(false);
  });

  it('cannot be tricked by extra client fields', () => {
    const tampered = [
      { question_id: 'q1', selected_option_id: 'q1b', time_ms: 0, is_correct: true },
      { question_id: 'q2', selected_option_id: 'q2b', time_ms: 0, is_correct: true },
    ] as unknown as Array<{ question_id: string; selected_option_id: string; time_ms: number }>;

    const scored = scoreSubmission(makeQuiz(), tampered);
    expect(scored.score).toBe(0);
    expect(scored.perfect).toBe(false);
  });

  it('drops answers for questions outside the quiz and duplicate answers', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1a', time_ms: 0 },
      { question_id: 'q1', selected_option_id: 'q1b', time_ms: 0 },
      { question_id: 'not-in-quiz', selected_option_id: 'x', time_ms: 0 },
    ]);

    expect(scored.graded).toHaveLength(1);
    expect(scored.score).toBe(1);
  });

  it('counts a skipped question as unanswered', () => {
    const scored = scoreSubmission(makeQuiz(), [
      { question_id: 'q1', selected_option_id: '', time_ms: 0 },
    ]);

    expect(scored.score).toBe(0);
    expect(scored.graded).toHaveLength(1);
    expect(scored.graded[0].is_correct).toBe(false);
  });

  it('resolves a personality result from the dominant tag', () => {
    const personality = makeQuiz({
      quiz_type: 'personality',
      results: [
        { id: 'r-calm', title: 'The Calm One', description: 'Steady.', personality_tag: 'calm' },
        { id: 'r-bold', title: 'The Bold One', description: 'Loud.', personality_tag: 'bold' },
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

    const scored = scoreSubmission(personality, [
      { question_id: 'p1', selected_option_id: 'p1a', time_ms: 0 },
      { question_id: 'p2', selected_option_id: 'p2a', time_ms: 0 },
    ]);

    expect(scored.resultId).toBe('r-calm');
    expect(scored.resultTitle).toBe('The Calm One');
    // Personality quizzes have no wrong answers: completing them is the pass.
    expect(scored.score).toBe(2);
    expect(scored.perfect).toBe(true);
  });
});

describe('buildReview', () => {
  it('serialises the right answer without exposing the key', () => {
    const review = buildReview(makeQuiz(), [
      { question_id: 'q1', selected_option_id: 'q1b', is_correct: false },
    ]);

    expect(review).toEqual([
      {
        questionId: 'q1',
        question: 'Which planet has the most moons?',
        selectedOptionText: 'Mars',
        correctOptionText: 'Saturn',
        isCorrect: false,
      },
    ]);
    expect(JSON.stringify(review)).not.toContain('is_correct');
  });
});

describe('QuizSubmissionSchema', () => {
  const valid = {
    quizId: '123e4567-e89b-12d3-a456-426614174000',
    answers: [{ question_id: 'q1', selected_option_id: 'q1a', time_ms: 500 }],
    timeTakenSeconds: 12,
  };

  it('accepts a well-formed submission', () => {
    expect(QuizSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-uuid quiz id', () => {
    expect(QuizSubmissionSchema.safeParse({ ...valid, quizId: 'x' }).success).toBe(false);
  });

  it('rejects empty and oversized answer lists', () => {
    expect(QuizSubmissionSchema.safeParse({ ...valid, answers: [] }).success).toBe(false);
    const many = Array.from({ length: 51 }, (_, index) => ({
      question_id: `q${index}`,
      selected_option_id: 'a',
    }));
    expect(QuizSubmissionSchema.safeParse({ ...valid, answers: many }).success).toBe(false);
  });

  it('rejects impossible timings', () => {
    expect(
      QuizSubmissionSchema.safeParse({
        ...valid,
        answers: [{ question_id: 'q1', selected_option_id: 'a', time_ms: -1 }],
      }).success
    ).toBe(false);
  });
});

describe('pointsFor', () => {
  it('mirrors the database trigger', () => {
    expect(pointsFor(false)).toBe(10);
    expect(pointsFor(true)).toBe(35);
  });
});

describe('quiz slugs', () => {
  it('slugifies titles with accents and punctuation', () => {
    expect(slugifyTitle('¿Qué personaje eres?', 'es')).toBe('es-que-personaje-eres');
    expect(slugifyTitle('Star Wars & Friends')).toBe('star-wars-and-friends');
  });

  it('falls back when a title has no usable characters', () => {
    expect(slugifyTitle('!!!')).toBe('quiz');
  });

  it('suffixes on collision', async () => {
    const taken = new Set(['en-quiz', 'en-quiz-2']);
    const slug = await generateUniqueSlug('Quiz', {
      language: 'en',
      exists: async (candidate) => taken.has(candidate),
    });
    expect(slug).toBe('en-quiz-3');
  });

  it('does not query when the first candidate is free', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    await expect(generateUniqueSlug('Fresh Title', { exists })).resolves.toBe('fresh-title');
    expect(exists).toHaveBeenCalledTimes(1);
  });
});
