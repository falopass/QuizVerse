/**
 * Compatibilidad en `/[locale]/quiz/[slug]/result`: un test de personalidad
 * jugado desde el enlace de un amigo muestra la tarjeta con la afinidad de
 * ambos. Un token de otro quiz no pinta nada; trivia sigue con la
 * comparativa clásica del reto; y sin tags que comparar se cae a ella.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getQuizSessionByShareToken: vi.fn(),
  getRelatedQuizzes: vi.fn(),
  getChallengeForQuiz: vi.fn(),
  getPersonalityChallengeForQuiz: vi.fn(),
  getUser: vi.fn(),
  loadAnswerKeyBySlug: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  getQuizSessionByShareToken: mocks.getQuizSessionByShareToken,
  getRelatedQuizzes: mocks.getRelatedQuizzes,
}));

vi.mock('@/lib/data/challenge', () => ({
  getChallengeForQuiz: mocks.getChallengeForQuiz,
  getPersonalityChallengeForQuiz: mocks.getPersonalityChallengeForQuiz,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock('@/lib/quiz/quiz-repository', () => ({
  loadAnswerKeyBySlug: mocks.loadAnswerKeyBySlug,
}));

import LocalizedQuizResultPage from '@/app/[locale]/quiz/[slug]/result/page';
import type { Quiz, QuizSessionResult } from '@/types/quiz';

const SESSION_TOKEN = 'aaaa1111bbbb2222';
const CHALLENGER_TOKEN = 'cccc3333dddd4444';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-p',
    slug: 'personajes',
    title: 'What Warrior Are You',
    description: 'A personality quiz.',
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: 'easy',
    language: 'en',
    questions: [
      {
        id: 'q1',
        question: 'Pick one',
        options: [
          { id: 'q1a', text: 'Fight', personality_tags: ['hero'] },
          { id: 'q1b', text: 'Flee', personality_tags: ['rival'] },
        ],
      },
      {
        id: 'q2',
        question: 'Pick another',
        options: [
          { id: 'q2a', text: 'Lead', personality_tags: ['rival'] },
          { id: 'q2b', text: 'Help', personality_tags: ['hero'] },
        ],
      },
    ],
    results: [
      {
        id: 'r-hero',
        title: 'The Hero',
        description: 'Bold and kind.',
        personality_tag: 'hero',
      },
      {
        id: 'r-rival',
        title: 'The Rival',
        description: 'Proud and fierce.',
        personality_tag: 'rival',
      },
    ],
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

function makeSession(overrides: Partial<QuizSessionResult> = {}): QuizSessionResult {
  return {
    id: 'session-1',
    quiz_id: 'quiz-p',
    player_id: null,
    score: 2,
    max_score: 2,
    percentage: 100,
    result_id: 'r-hero',
    result_title: 'The Hero',
    time_taken_seconds: null,
    answers: [
      { question_id: 'q1', selected_option_id: 'q1a', is_correct: true, time_ms: 0 },
      { question_id: 'q2', selected_option_id: 'q2a', is_correct: true, time_ms: 0 },
    ],
    share_token: SESSION_TOKEN,
    was_shared: false,
    completed_at: '2026-10-19T00:00:00Z',
    ...overrides,
  };
}

/** Reto de personality: mi vector {hero,rival} contra {rival,rival} → 71%. */
const peer = {
  token: CHALLENGER_TOKEN,
  score: 2,
  maxScore: 2,
  resultTitle: 'The Rival',
  resultId: 'r-rival',
  tags: ['rival', 'rival'],
};

function renderPage(query: Record<string, string> = {}, locale = 'en') {
  return LocalizedQuizResultPage({
    params: Promise.resolve({ locale, slug: 'personajes' }),
    searchParams: Promise.resolve(query),
  }).then((jsx) => render(jsx));
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true })),
  });
});

beforeEach(() => {
  mocks.getQuizBySlug.mockReset().mockResolvedValue(makeQuiz());
  mocks.getQuizSessionByShareToken.mockReset().mockResolvedValue(null);
  mocks.getRelatedQuizzes.mockReset().mockResolvedValue([]);
  mocks.getChallengeForQuiz.mockReset().mockResolvedValue(null);
  mocks.getPersonalityChallengeForQuiz.mockReset().mockResolvedValue(null);
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
  mocks.loadAnswerKeyBySlug.mockReset().mockResolvedValue(null);
});

describe('/result — tarjeta de compatibilidad', () => {
  it('pinta la afinidad de los dos resultados en un reto de personalidad', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.getPersonalityChallengeForQuiz.mockResolvedValue(peer);

    await renderPage({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN });

    expect(screen.getByText('Compatibility')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText('Great team')).toBeInTheDocument();
    // «The Hero» sale dos veces: el titular del resultado y el lado propio.
    expect(screen.getAllByText('The Hero').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('The Rival')).toBeInTheDocument();
    // La tarjeta reemplaza a la comparativa clásica.
    expect(screen.queryByText('Challenge showdown')).not.toBeInTheDocument();
    // Y ofrece invitar a otro amigo con el enlace propio.
    expect(screen.getByRole('button', { name: 'Compare with another friend' })).toBeInTheDocument();
  });

  it('la etiqueta y el fallback de nombre salen en español', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.getPersonalityChallengeForQuiz.mockResolvedValue(peer);

    await renderPage({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN }, 'es');

    expect(screen.getByText('Compatibilidad')).toBeInTheDocument();
    expect(screen.getByText('Buen equipo')).toBeInTheDocument();
    expect(screen.getByText('tu amigo')).toBeInTheDocument();
  });

  it('un token de otro quiz no pinta tarjeta ni comparativa', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.getPersonalityChallengeForQuiz.mockResolvedValue(null);

    await renderPage({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN });

    expect(screen.queryByText('Compatibility')).not.toBeInTheDocument();
    expect(screen.queryByText('Challenge showdown')).not.toBeInTheDocument();
  });

  it('sin tags del retador cae a la comparativa clásica', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.getPersonalityChallengeForQuiz.mockResolvedValue({ ...peer, tags: [] });

    await renderPage({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN });

    expect(screen.queryByText('Compatibility')).not.toBeInTheDocument();
    expect(screen.getByText('Challenge showdown')).toBeInTheDocument();
    expect(screen.getByText('Different results')).toBeInTheDocument();
  });

  it('una invitación (s == challenge) no consulta ni pinta la tarjeta', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN, challenge: SESSION_TOKEN });

    expect(mocks.getPersonalityChallengeForQuiz).not.toHaveBeenCalled();
    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();
    expect(screen.queryByText('Compatibility')).not.toBeInTheDocument();
  });

  it('en trivia el reto sigue mostrando la comparativa de marcadores', async () => {
    mocks.getQuizBySlug.mockResolvedValue(makeQuiz({ quiz_type: 'trivia', results: null }));
    mocks.getQuizSessionByShareToken.mockResolvedValue(
      makeSession({ result_id: null, result_title: null, score: 1 })
    );
    mocks.getChallengeForQuiz.mockResolvedValue({
      token: CHALLENGER_TOKEN,
      score: 0,
      maxScore: 2,
      resultTitle: null,
    });

    await renderPage({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN });

    // En trivia no se consulta la vía de personalidad.
    expect(mocks.getPersonalityChallengeForQuiz).not.toHaveBeenCalled();
    expect(screen.queryByText('Compatibility')).not.toBeInTheDocument();
    expect(screen.getByText('Challenge showdown')).toBeInTheDocument();
  });
});
