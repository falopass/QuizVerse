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
  getPersonalityChallengeForQuiz: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  getQuizSessionByShareToken: mocks.getQuizSessionByShareToken,
}));

vi.mock('@/lib/data/challenge', () => ({
  getChallengeForQuiz: mocks.getChallengeForQuiz,
  getPersonalityChallengeForQuiz: mocks.getPersonalityChallengeForQuiz,
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
  share_token: '0123456789abcdef',
  was_shared: false,
  completed_at: '2026-10-19T00:00:00Z',
};

const challenger = { token: 'abcdef0123456789', score: 5, maxScore: 8, resultTitle: null };

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
  mocks.getPersonalityChallengeForQuiz.mockReset().mockResolvedValue(null);
});

describe('GET /api/og/result/[locale]/[slug]', () => {
  it('returns the result card as PNG for a valid quiz and share token', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(session);

    const res = await call(ogUrl('?s=0123456789abcdef'));
    const bytes = await expectPng(res);

    expect(mocks.getQuizSessionByShareToken).toHaveBeenCalledWith('0123456789abcdef');
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400');

    // The session must reach the card: with its score the render differs
    // from the generic preview shown without a token.
    const plain = await call(ogUrl());
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(false);
  });

  it('draws the session score into the result card', async () => {
    // A different score must change the pixels: if resultCard dropped the
    // session or stopped drawing the score, both renders would be identical.
    mocks.getQuizSessionByShareToken.mockResolvedValue(session);
    const seven = await call(ogUrl('?s=0123456789abcdef'));
    const sevenBytes = new Uint8Array(await seven.arrayBuffer());

    mocks.getQuizSessionByShareToken.mockResolvedValue({ ...session, score: 3 });
    const three = await call(ogUrl('?s=0123456789abcdef'));
    const threeBytes = new Uint8Array(await three.arrayBuffer());

    expect(Buffer.from(threeBytes).equals(Buffer.from(sevenBytes))).toBe(false);
  });

  it('returns the base cover (never a 500) when the slug does not exist', async () => {
    mocks.getQuizBySlug.mockResolvedValue(null);

    const res = await call(ogUrl(), 'en', 'missing-slug');

    await expectPng(res);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    expect(mocks.getQuizSessionByShareToken).not.toHaveBeenCalled();
  });

  it('never queries the data layer for tokens without the 16-hex share format', async () => {
    const res = await call(ogUrl('?s=zzz-not-a-token&c=also-not-hex'));

    await expectPng(res);
    expect(mocks.getQuizSessionByShareToken).not.toHaveBeenCalled();
    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();
  });

  it('ignores a share token that belongs to another quiz', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue({ ...session, quiz_id: 'other-quiz' });
    mocks.getChallengeForQuiz.mockResolvedValue(challenger);

    const res = await call(ogUrl('?s=0123456789abcdef&c=abcdef0123456789'));
    const bytes = await expectPng(res);

    // Not the versus branch: identical render to the plain card with no session.
    const plain = await call(ogUrl());
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(true);
  });

  it('renders the versus card when share and challenge tokens are valid', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(session);
    mocks.getChallengeForQuiz.mockResolvedValue(challenger);

    const res = await call(ogUrl('?s=0123456789abcdef&c=abcdef0123456789'));
    const bytes = await expectPng(res);

    expect(mocks.getChallengeForQuiz).toHaveBeenCalledWith('abcdef0123456789', 'quiz-1');

    // The versus branch renders differently from the plain result card.
    const plain = await call(ogUrl('?s=0123456789abcdef'));
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(false);
  });

  it('renders a personality result title with accents and a long quiz title', async () => {
    mocks.getQuizBySlug.mockResolvedValue({
      ...quiz,
      id: 'quiz-p',
      quiz_type: 'personality',
      title: '¿Qué personaje de anime eres según tu personalidad y tus decisiones?',
      category: { name: 'Anime y manga', icon: '⛩', slug: 'anime-manga' },
    } as unknown as Quiz);
    mocks.getQuizSessionByShareToken.mockResolvedValue({
      ...session,
      quiz_id: 'quiz-p',
      result_title: 'El Estratega Melancólico',
    });

    const res = await call(ogUrl('?s=0123456789abcdef'), 'es');

    await expectPng(res);
  });

  it('renders the compatibility versus for a personality challenge', async () => {
    mocks.getQuizBySlug.mockResolvedValue({
      ...quiz,
      id: 'quiz-p',
      quiz_type: 'personality',
      questions: [
        {
          id: 'q1',
          options: [
            { id: 'q1a', personality_tags: ['hero'] },
            { id: 'q1b', personality_tags: ['rival'] },
          ],
        },
      ],
    } as unknown as Quiz);
    mocks.getQuizSessionByShareToken.mockResolvedValue({
      ...session,
      quiz_id: 'quiz-p',
      result_id: 'r-hero',
      result_title: 'The Hero',
      answers: [{ question_id: 'q1', selected_option_id: 'q1a', is_correct: true, time_ms: 0 }],
    });
    mocks.getPersonalityChallengeForQuiz.mockResolvedValue({
      token: 'abcdef0123456789',
      score: 1,
      maxScore: 1,
      resultTitle: 'The Rival',
      resultId: 'r-rival',
      tags: ['rival'],
    });

    const res = await call(ogUrl('?s=0123456789abcdef&c=abcdef0123456789'));
    const bytes = await expectPng(res);

    // La vía de personalidad resuelve el reto con tags, no con getChallengeForQuiz.
    expect(mocks.getPersonalityChallengeForQuiz).toHaveBeenCalledWith(
      'abcdef0123456789',
      expect.objectContaining({ id: 'quiz-p' })
    );
    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();

    // Y el render no es la tarjeta personal.
    const plain = await call(ogUrl('?s=0123456789abcdef'));
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(false);
  });

  it('renders the personal card when the challenge token is the session itself', async () => {
    // ?s=A&c=A es una invitación abierta: no hay dos marcadores y una tarjeta
    // versus diría "TIE" sobre un reto que nadie ha jugado todavía.
    mocks.getQuizSessionByShareToken.mockResolvedValue(session);

    const res = await call(ogUrl('?s=0123456789abcdef&c=0123456789abcdef'));
    const bytes = await expectPng(res);

    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();

    const plain = await call(ogUrl('?s=0123456789abcdef'));
    const plainBytes = new Uint8Array(await plain.arrayBuffer());
    expect(Buffer.from(bytes).equals(Buffer.from(plainBytes))).toBe(true);
  });

  it('falls back to English for an unknown locale without throwing', async () => {
    const res = await call(ogUrl(), 'fr');

    await expectPng(res);
    expect(mocks.getQuizBySlug).toHaveBeenCalledWith('space-trivia', 'en');
  });
});
