/**
 * Tests de `/[locale]/quiz/[slug]/result`: la página del resultado compartido.
 *
 * Contrato: og:url/canonical llevan el token de sesión para que Facebook y
 * WhatsApp lean la tarjeta personal; una sesión de otro quiz cuenta como
 * inexistente; sin sesión válida no se inventa marcador ni resultado (estado
 * vacío con CTA a jugar); «Aceptar el reto» apunta a la marca del retador; y
 * el texto compartido a WhatsApp/X incluye el resultado.
 */

import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getQuizSessionByShareToken: vi.fn(),
  getRelatedQuizzes: vi.fn(),
  getChallengeForQuiz: vi.fn(),
}));

vi.mock('@/lib/data/public', () => ({
  getQuizBySlug: mocks.getQuizBySlug,
  getQuizSessionByShareToken: mocks.getQuizSessionByShareToken,
  getRelatedQuizzes: mocks.getRelatedQuizzes,
}));

vi.mock('@/lib/data/challenge', () => ({
  getChallengeForQuiz: mocks.getChallengeForQuiz,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import LocalizedQuizResultPage, { generateMetadata } from '@/app/[locale]/quiz/[slug]/result/page';
import { ResultScreen } from '@/components/quiz/result-screen';
import { SITE_URL } from '@/lib/seo/site';
import type { Quiz, QuizSessionResult } from '@/types/quiz';

// Tokens con el formato real de game_sessions.share_token (16 hex).
const SESSION_TOKEN = 'aaaa1111bbbb2222';
const CHALLENGER_TOKEN = 'cccc3333dddd4444';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
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
          { id: 'q1a', text: 'Saturn' },
          { id: 'q1b', text: 'Mars' },
        ],
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

function makeSession(overrides: Partial<QuizSessionResult> = {}): QuizSessionResult {
  return {
    id: 'session-1',
    quiz_id: 'quiz-1',
    player_id: null,
    score: 7,
    max_score: 8,
    percentage: 87,
    result_id: null,
    result_title: null,
    time_taken_seconds: null,
    answers: [],
    share_token: SESSION_TOKEN,
    was_shared: false,
    completed_at: '2026-10-19T00:00:00Z',
    ...overrides,
  };
}

const params = () => Promise.resolve({ locale: 'en', slug: 'space-trivia' });
const searchParams = (value: Record<string, string> = {}) => Promise.resolve(value);

function renderPage(query: Record<string, string> = {}, locale = 'en') {
  return LocalizedQuizResultPage({
    params: Promise.resolve({ locale, slug: 'space-trivia' }),
    searchParams: searchParams(query),
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
});

describe('generateMetadata — resultado compartido', () => {
  it('incluye el token en canonical y og:url para la tarjeta personal', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    const metadata = await generateMetadata({
      params: params(),
      searchParams: searchParams({ s: SESSION_TOKEN }),
    });

    const canonical = `${SITE_URL}/en/quiz/space-trivia/result?s=${SESSION_TOKEN}`;
    expect(metadata.alternates?.canonical).toBe(canonical);
    expect((metadata.openGraph as Record<string, unknown>).url).toBe(canonical);
    // og:image apunta a la tarjeta personal de esa sesión.
    const images = (metadata.openGraph as Record<string, unknown>).images as Array<{
      url: string;
    }>;
    expect(images[0].url).toContain(`s=${SESSION_TOKEN}`);
    expect(metadata.title).toBe('7/8 · Space Trivia');
  });

  it('añade challenge a canonical/og:url cuando el reto es válido', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.getChallengeForQuiz.mockResolvedValue({
      token: CHALLENGER_TOKEN,
      score: 5,
      maxScore: 8,
      resultTitle: null,
    });

    const metadata = await generateMetadata({
      params: params(),
      searchParams: searchParams({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN }),
    });

    const canonical = `${SITE_URL}/en/quiz/space-trivia/result?s=${SESSION_TOKEN}&challenge=${CHALLENGER_TOKEN}`;
    expect(metadata.alternates?.canonical).toBe(canonical);
    expect((metadata.openGraph as Record<string, unknown>).url).toBe(canonical);
    const images = (metadata.openGraph as Record<string, unknown>).images as Array<{
      url: string;
    }>;
    expect(images[0].url).toContain(`c=${CHALLENGER_TOKEN}`);
  });

  it('trata una sesión de otro quiz como inexistente', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession({ quiz_id: 'otro-quiz' }));

    const metadata = await generateMetadata({
      params: params(),
      searchParams: searchParams({ s: SESSION_TOKEN }),
    });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/en/quiz/space-trivia/result`);
    expect(metadata.title).toBe('My result in Space Trivia');
  });

  it('no refleja un token arbitrario ni lo consulta', async () => {
    const metadata = await generateMetadata({
      params: params(),
      searchParams: searchParams({ s: '"><script>alert(1)</script>' }),
    });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/en/quiz/space-trivia/result`);
    expect(String(metadata.alternates?.canonical)).not.toContain('script');
    expect(mocks.getQuizSessionByShareToken).not.toHaveBeenCalled();
  });
});

describe('LocalizedQuizResultPage — sin sesión válida', () => {
  it('sin token muestra el estado vacío con CTA a jugar', async () => {
    await renderPage();

    expect(
      screen.getByRole('heading', { name: "You haven't played this quiz yet" })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Play now' })).toHaveAttribute(
      'href',
      '/en/quiz/space-trivia/play'
    );
    // Sin marcador ni resultado fabricado.
    expect(screen.queryByText('Scoreline')).not.toBeInTheDocument();
    expect(mocks.getRelatedQuizzes).not.toHaveBeenCalled();
  });

  it('muestra el estado vacío en español', async () => {
    await renderPage({}, 'es');

    expect(
      screen.getByRole('heading', { name: 'Aún no has jugado este quiz' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jugar ahora' })).toHaveAttribute(
      'href',
      '/es/quiz/space-trivia/play'
    );
  });

  it('un token de otro quiz muestra el estado vacío, no el marcador ajeno', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession({ quiz_id: 'otro-quiz' }));

    await renderPage({ s: SESSION_TOKEN });

    expect(
      screen.getByRole('heading', { name: "You haven't played this quiz yet" })
    ).toBeInTheDocument();
    expect(screen.queryByText('87%')).not.toBeInTheDocument();
  });

  it('un token arbitrario ni siquiera se consulta', async () => {
    await renderPage({ s: 'no-es-un-token' });

    expect(mocks.getQuizSessionByShareToken).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: "You haven't played this quiz yet" })
    ).toBeInTheDocument();
  });
});

describe('LocalizedQuizResultPage — con sesión', () => {
  it('pinta el marcador de la sesión', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN });

    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('7/8 correct')).toBeInTheDocument();
  });

  it('«Take the challenge» apunta al token del retador, no al propio', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.getChallengeForQuiz.mockResolvedValue({
      token: CHALLENGER_TOKEN,
      score: 5,
      maxScore: 8,
      resultTitle: null,
    });

    await renderPage({ s: SESSION_TOKEN, challenge: CHALLENGER_TOKEN });

    const accept = screen.getByRole('link', { name: 'Take the challenge' });
    expect(accept).toHaveAttribute(
      'href',
      `/en/quiz/space-trivia/play?challenge=${CHALLENGER_TOKEN}`
    );
  });

  it('sin reto activo, «Take the challenge» apunta a la sesión compartida', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN });

    expect(screen.getByRole('link', { name: 'Take the challenge' })).toHaveAttribute(
      'href',
      `/en/quiz/space-trivia/play?challenge=${SESSION_TOKEN}`
    );
  });
});

describe('ResultScreen — texto compartido', () => {
  it('el texto de WhatsApp incluye el resultado obtenido', async () => {
    render(
      <ResultScreen
        locale="en"
        quiz={makeQuiz({
          quiz_type: 'personality',
          title: 'What Animal Are You',
          questions: [],
        })}
        result={{
          id: 'r1',
          title: 'The Wolf',
          description: 'Loyal and fierce.',
        }}
        answers={[]}
        shareUrl={`${SITE_URL}/en/quiz/space-trivia/result?s=${SESSION_TOKEN}`}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share result' }));

    const whatsapp = screen.getByRole('link', { name: /whatsapp/i });
    const shared = decodeURIComponent(whatsapp.getAttribute('href') ?? '');
    expect(shared).toContain('I got The Wolf on "What Animal Are You" — can you beat it?');
    expect(shared).toContain(`s=${SESSION_TOKEN}`);
  });
});
