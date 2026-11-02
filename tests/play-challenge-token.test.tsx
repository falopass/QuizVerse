/**
 * The /play page resolves the `challenge` query param against PostgREST. Only
 * strings with the real share-token format (16 hex) may reach the data layer —
 * anything else is ignored before the query, same as /result already did.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getChallengeForQuiz: vi.fn(),
  getRelatedQuizzes: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  // El reproductor pinta relacionados al terminar; aquí no participan.
  getRelatedQuizzes: mocks.getRelatedQuizzes,
}));

vi.mock('@/lib/data/challenge', () => ({
  getChallengeForQuiz: mocks.getChallengeForQuiz,
}));

vi.mock('@/components/quiz/quiz-player', () => ({ QuizPlayer: () => null }));
vi.mock('@/components/quiz/challenge-banner', () => ({ ChallengeBanner: () => null }));

import Page, { generateMetadata } from '@/app/[locale]/quiz/[slug]/play/page';
import type { Quiz } from '@/types/quiz';

const quiz = {
  id: 'quiz-1',
  slug: 'space-trivia',
  title: 'Space Trivia',
  description: 'How much do you know about space?',
  quiz_type: 'trivia',
  questions: [],
} as unknown as Quiz;

const params = Promise.resolve({ locale: 'en', slug: 'space-trivia' });
const withChallenge = (challenge?: string) => Promise.resolve({ challenge });

beforeEach(() => {
  mocks.getQuizBySlug.mockReset().mockResolvedValue(quiz);
  mocks.getChallengeForQuiz.mockReset().mockResolvedValue(null);
  mocks.getRelatedQuizzes.mockReset().mockResolvedValue([]);
});

describe('/play challenge token', () => {
  it('ignores a challenge param without the share-token format in the page', async () => {
    await Page({ params, searchParams: withChallenge('zzz-not-a-token') });

    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();
  });

  it('ignores a challenge param without the share-token format in metadata', async () => {
    await generateMetadata({ params, searchParams: withChallenge('zzz-not-a-token') });

    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();
  });

  it('resolves a well-formed challenge token in both render paths', async () => {
    await Page({ params, searchParams: withChallenge('0123456789abcdef') });
    await generateMetadata({ params, searchParams: withChallenge('0123456789abcdef') });

    expect(mocks.getChallengeForQuiz).toHaveBeenCalledWith('0123456789abcdef', 'quiz-1');
    expect(mocks.getChallengeForQuiz).toHaveBeenCalledTimes(2);
  });
});
