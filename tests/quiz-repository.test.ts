/**
 * Tests for the single door to the answer key.
 *
 * `loadAnswerKeyByQuizId` is the only module allowed to read a quiz's full
 * `questions`/`results`, and its `status = 'published'` filter is what keeps a
 * draft unplayable even by id. These tests pin that guarantee plus the raw
 * jsonb parsing that happens on the way out.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromSpy, selectSpy, eqIdSpy, eqStatusSpy, maybeSingleSpy } = vi.hoisted(() => ({
  fromSpy: vi.fn(),
  selectSpy: vi.fn(),
  eqIdSpy: vi.fn(),
  eqStatusSpy: vi.fn(),
  maybeSingleSpy: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: fromSpy }),
}));

import { loadAnswerKeyByQuizId } from '@/lib/quiz/quiz-repository';

const QUIZ_ID = '123e4567-e89b-12d3-a456-426614174000';

// Raw jsonb as stored in `quizzes`: every option carries `is_correct` and the
// payload keeps fields like `explanation` and `time_limit_seconds`.
const PUBLISHED_ROW = {
  id: QUIZ_ID,
  slug: 'en-the-boys-trivia',
  quiz_type: 'trivia',
  questions: [
    {
      id: 'q1',
      question: 'What is the name of the substance that gives superheroes their powers?',
      options: [
        { id: 'a', text: 'Compound V', is_correct: true },
        { id: 'b', text: 'Serum X', is_correct: false },
        { id: 'c', text: 'Power-ade', is_correct: false },
        { id: 'd', text: 'Vought Juice', is_correct: false },
      ],
      explanation: 'Compound V is the signature chemical developed by Vought.',
      time_limit_seconds: 30,
    },
    {
      id: 'q2',
      question: 'Who leads The Seven?',
      options: [
        { id: 'a', text: 'Homelander', is_correct: true },
        { id: 'b', text: 'Black Noir', is_correct: false },
      ],
      explanation: null,
      time_limit_seconds: 30,
    },
  ],
  results: null,
};

describe('loadAnswerKeyByQuizId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromSpy.mockReturnValue({ select: selectSpy });
    selectSpy.mockReturnValue({ eq: eqIdSpy });
    eqIdSpy.mockReturnValue({ eq: eqStatusSpy });
    eqStatusSpy.mockReturnValue({ maybeSingle: maybeSingleSpy });
  });

  it('returns the parsed answer key for a published quiz', async () => {
    maybeSingleSpy.mockResolvedValue({ data: PUBLISHED_ROW, error: null });

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz).toMatchObject({
      id: QUIZ_ID,
      slug: 'en-the-boys-trivia',
      quiz_type: 'trivia',
    });
    expect(quiz?.questions).toHaveLength(2);
    // The key survives the trip: the server keeps `is_correct` for scoring.
    expect(quiz?.questions[0].options[0]).toMatchObject({ id: 'a', is_correct: true });
    expect(quiz?.results).toBeNull();
  });

  it('queries only published quizzes, so a draft stays unplayable even by id', async () => {
    maybeSingleSpy.mockResolvedValue({ data: PUBLISHED_ROW, error: null });

    await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(fromSpy).toHaveBeenCalledWith('quizzes');
    expect(selectSpy).toHaveBeenCalledWith('id, slug, quiz_type, questions, results');
    expect(eqIdSpy).toHaveBeenCalledWith('id', QUIZ_ID);
    expect(eqStatusSpy).toHaveBeenCalledWith('status', 'published');
  });

  it('returns null when the quiz is a draft or does not exist', async () => {
    maybeSingleSpy.mockResolvedValue({ data: null, error: null });

    await expect(loadAnswerKeyByQuizId(QUIZ_ID)).resolves.toBeNull();
  });

  it('returns null on a supabase error instead of throwing', async () => {
    maybeSingleSpy.mockResolvedValue({
      data: null,
      error: { message: 'connection failed', code: 'XX000' },
    });

    await expect(loadAnswerKeyByQuizId(QUIZ_ID)).resolves.toBeNull();
  });

  it('keeps the personality results array from the raw row', async () => {
    maybeSingleSpy.mockResolvedValue({
      data: {
        ...PUBLISHED_ROW,
        quiz_type: 'personality',
        results: [
          {
            id: 'r1',
            title: 'The Reporter',
            description: 'You expose the rot.',
            personality_tag: 'reporter',
            background_theme: 'fire',
          },
        ],
      },
      error: null,
    });

    const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

    expect(quiz?.results).toHaveLength(1);
    expect(quiz?.results?.[0]).toMatchObject({ id: 'r1', personality_tag: 'reporter' });
  });

  it('returns an empty question list when raw questions is not an array', async () => {
    for (const raw of [null, { text: 'oops' }, 'not-an-array']) {
      maybeSingleSpy.mockResolvedValueOnce({
        data: { ...PUBLISHED_ROW, questions: raw },
        error: null,
      });

      const quiz = await loadAnswerKeyByQuizId(QUIZ_ID);

      // parseQuestions does not throw on malformed jsonb: it falls back to [].
      expect(quiz?.questions).toEqual([]);
    }
  });
});
