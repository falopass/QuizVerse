// @vitest-environment node
/**
 * Contract tests for GET /api/og/result/[locale]/[slug].
 *
 * The route renders three PNG cards: the quiz result card (?s=<shareToken>),
 * the versus card (?s=<shareToken>&c=<challengeToken>) and a base cover when
 * the quiz does not exist. A regression here silently breaks every social
 * preview, so the contract is: always 200 + PNG, tokens of another quiz are
 * ignored, and unknown locales fall back to English.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getQuizSessionByShareToken: vi.fn(),
  getChallengeForQuiz: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  getQuizSessionByShareToken: mocks.getQuizSessionByShareToken,
}));

vi.mock('@/lib/data/challenge', () => ({
  getChallengeForQuiz: mocks.getChallengeForQuiz,
}));

import { GET } from '@/app/api/og/result/[locale]/[slug]/route';
import type { Quiz } from '@/types/quiz';
import type { QuizSessionResult } from '@/types/quiz';

const quiz = {
  id: 'quiz-1',
  slug: 'space-trivia',
  title: 'Space Trivia',
  description: 'How much do you know about space?',
  quiz_type: 'trivia',
  estimated_minutes: 3,
  questions: Array.from({ length: 8 }, (_, i) => ({ id: `q${i}` })),
  category: { name: 'Science', icon: 'S', slug: 'science' },
} as unknown as Quiz;

const session: QuizSessionResult = {
  id: 'session-1',
  quiz_id: 'quiz-1',
  player_id: null,
  score: 7,
  max_score: 8,
  percentage: 87,
  result_id: null,
  result_title: null,
  time_taken_seconds: null,
  answers: null,
  share_token: 'share-token-1',
  was_shared: false,
  completed_at: '2026-10-19T00:00:00Z',
};

const challenger = { token: 'challenge-token-1', score: 5, maxScore: 8, resultTitle: null };

function call(url: string, locale = 'en', slug = 'space-trivia') {
  return GET(new Request(url), { params: Promise.resolve({ locale, slug }) });
}

const ogUrl = (query = '') => `https://quizverse.org/api/og/result/en/space-trivia${query}`;

async function expectPng(res: Response) {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('image/png');
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect(bytes.length).toBeGreaterThan(100);
  // PNG signature: 89 50 4E 47
  expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  return bytes;
}

beforeEach(() => {
  mocks.getQuizBySlug.mockReset().mockResolvedValue(quiz);
  mocks.getQuizSessionByShareToken.mockReset().mockResolvedValue(null);
  mocks.getChallengeForQuiz.mockReset().mockResolvedValue(null);
});

describe('GET /api/og/result/[locale]/[slug]', () => {
  it('returns the result card as PNG for a valid quiz and share token', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(session);

    const res = await call(ogUrl('?s=share-token-1'));

    await expectPng(res);
    expect(mocks.getQuizSessionByShareToken).toHaveBeenCalledWith('share-token-1');
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400');
  });

  it('returns the base cover (never a 500) when the slug does not exist', async () => {
    mocks.getQuizBySlug.mockResolvedValue(null);

    const res = await call(ogUrl(), 'en', 'missing-slug');

    await expectPng(res);
    expect(mocks.getQuizSessionByShareToken).not.toHaveBeenCalled();
  });

  it('ignores a share token that belongs to another quiz', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue({ ...session, quiz_id: 'other-quiz' });
    mocks.getChallengeForQuiz.mockResolvedValue(challenger);

    const res = await call(ogUrl('?s=share-token-1&c=challenge-token-1'));
    const bytes = await expectPng(res);

    // Not the versus branch: identical render to the plain card with no session.
    const plain = await call(ogUrl());
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(true);
  });

  it('renders the versus card when share and challenge tokens are valid', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(session);
    mocks.getChallengeForQuiz.mockResolvedValue(challenger);

    const res = await call(ogUrl('?s=share-token-1&c=challenge-token-1'));
    const bytes = await expectPng(res);

    expect(mocks.getChallengeForQuiz).toHaveBeenCalledWith('challenge-token-1', 'quiz-1');

    // The versus branch renders differently from the plain result card.
    const plain = await call(ogUrl('?s=share-token-1'));
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(false);
  });

  it('falls back to English for an unknown locale without throwing', async () => {
    const res = await call(ogUrl(), 'fr');

    await expectPng(res);
    expect(mocks.getQuizBySlug).toHaveBeenCalledWith('space-trivia', 'en');
  });
});
