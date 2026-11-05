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
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const mocks = vi.hoisted(() => ({
  getQuizBySlug: vi.fn(),
  getQuizSessionByShareToken: vi.fn(),
  getRelatedQuizzes: vi.fn(),
  getChallengeForQuiz: vi.fn(),
  getPersonalityChallengeForQuiz: vi.fn(),
  getUser: vi.fn(),
  loadAnswerKeyBySlug: vi.fn(),
  fetchGroupByToken: vi.fn(),
  fetchGroupForSession: vi.fn(),
  createQuizGroup: vi.fn(),
  joinQuizGroup: vi.fn(),
  getQuizGroupLeaderboard: vi.fn(),
}));

// pickProfileNickname es pura: se mantiene la real para el apodo sugerido.
vi.mock('@/lib/data/group', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/data/group')>();
  return {
    ...original,
    fetchGroupByToken: mocks.fetchGroupByToken,
    fetchGroupForSession: mocks.fetchGroupForSession,
  };
});

vi.mock('@/actions/group.actions', () => ({
  createQuizGroup: mocks.createQuizGroup,
  joinQuizGroup: mocks.joinQuizGroup,
  getQuizGroupLeaderboard: mocks.getQuizGroupLeaderboard,
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
// Token de grupo: 20 hex (migración 021).
const GROUP_TOKEN = 'a1b2c3d4e5f6a1b2c3d4';
const GROUP = {
  id: 'group-1',
  quizId: 'quiz-1',
  token: GROUP_TOKEN,
  creatorNickname: 'Diego',
  createdAt: '2026-10-19T00:00:00Z',
};

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
  mocks.getPersonalityChallengeForQuiz.mockReset().mockResolvedValue(null);
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
  mocks.loadAnswerKeyBySlug.mockReset().mockResolvedValue(null);
  mocks.fetchGroupByToken.mockReset().mockResolvedValue({ state: 'ok', value: null });
  mocks.fetchGroupForSession.mockReset().mockResolvedValue(null);
  mocks.createQuizGroup.mockReset().mockResolvedValue({
    success: true,
    groupToken: GROUP_TOKEN,
    group: GROUP,
    reused: false,
  });
  mocks.joinQuizGroup.mockReset().mockResolvedValue({
    success: true,
    entry: {
      nickname: 'Diego',
      score: 7,
      maxScore: 8,
      timeTakenSeconds: 60,
      gameSessionId: 'session-1',
      createdAt: '2026-10-19T00:00:00Z',
    },
    alreadyJoined: false,
  });
  mocks.getQuizGroupLeaderboard.mockReset().mockResolvedValue({
    success: true,
    group: GROUP,
    entries: [],
  });
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

  it('describe el resultado en español neutro, sin voseo', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'es', slug: 'space-trivia' }),
      searchParams: searchParams({ s: SESSION_TOKEN }),
    });

    expect(metadata.description).toBe('Saqué 7/8 en Space Trivia. ¿Puedes superarlo?');
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
    expect(shared).toContain('The Wolf');
    expect(shared).toContain('What Animal Are You');
    expect(shared).toContain(`s=${SESSION_TOKEN}`);
    expect(shared).toContain('via=whatsapp');
  });
});

describe('LocalizedQuizResultPage — invitación de reto (s == challenge)', () => {
  it('no pinta la comparativa ni la consulta cuando el reto apunta a la propia sesión', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN, challenge: SESSION_TOKEN });

    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();
    expect(screen.queryByText('Challenge showdown')).not.toBeInTheDocument();
    // «Aceptar el reto» sigue apuntando a la marca del retador.
    expect(screen.getByRole('link', { name: 'Take the challenge' })).toHaveAttribute(
      'href',
      `/en/quiz/space-trivia/play?challenge=${SESSION_TOKEN}`
    );
  });

  it('la metadata de una invitación queda como resultado personal, sin versus', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    const metadata = await generateMetadata({
      params: params(),
      searchParams: searchParams({ s: SESSION_TOKEN, challenge: SESSION_TOKEN }),
    });

    expect(metadata.alternates?.canonical).toBe(
      `${SITE_URL}/en/quiz/space-trivia/result?s=${SESSION_TOKEN}`
    );
    const images = (metadata.openGraph as Record<string, unknown>).images as Array<{
      url: string;
    }>;
    expect(images[0].url).not.toContain('c=');
    expect(mocks.getChallengeForQuiz).not.toHaveBeenCalled();
  });
});

describe('ResultScreen — «Reta a un amigo»', () => {
  it('pide el apodo del creador y comparte el enlace del grupo', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN });

    fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));

    const dialog = screen.getByRole('dialog', { name: 'Challenge a friend' });
    fireEvent.change(within(dialog).getByLabelText('Your nickname for the group'), {
      target: { value: 'Diego' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create leaderboard' }));

    const whatsapp = await within(dialog).findByRole('link', { name: /whatsapp/i });
    const shared = decodeURIComponent(whatsapp.getAttribute('href') ?? '');
    expect(shared).toContain(`?g=${GROUP_TOKEN}`);
    expect(mocks.createQuizGroup).toHaveBeenCalledWith({
      shareToken: SESSION_TOKEN,
      nickname: 'Diego',
    });
    expect(mocks.joinQuizGroup).toHaveBeenCalledWith({
      groupToken: GROUP_TOKEN,
      sessionToken: SESSION_TOKEN,
      nickname: 'Diego',
    });
  });

  it('cae al enlace de reto clásico si el grupo aún no está disponible', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());
    mocks.createQuizGroup.mockResolvedValue({
      success: false,
      code: 'unavailable',
      error: 'not yet',
    });

    await renderPage({ s: SESSION_TOKEN });

    fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));
    const dialog = screen.getByRole('dialog', { name: 'Challenge a friend' });
    fireEvent.change(within(dialog).getByLabelText('Your nickname for the group'), {
      target: { value: 'Diego' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create leaderboard' }));

    const whatsapp = await within(dialog).findByRole('link', { name: /whatsapp/i });
    const shared = decodeURIComponent(whatsapp.getAttribute('href') ?? '');
    expect(shared).toContain(`s=${SESSION_TOKEN}&challenge=${SESSION_TOKEN}`);
  });

  it('«Share result» sigue compartiendo la URL limpia', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN });

    fireEvent.click(screen.getByRole('button', { name: 'Share result' }));

    const dialog = screen.getByRole('dialog', { name: 'Share result' });
    const whatsapp = within(dialog).getByRole('link', { name: /whatsapp/i });
    const shared = decodeURIComponent(whatsapp.getAttribute('href') ?? '');
    expect(shared).toContain(`s=${SESSION_TOKEN}`);
    expect(shared).not.toContain('challenge=');
  });
});

describe('ResultScreen — cuenta y puntos honestos', () => {
  it('ofrece crear cuenta al visitante anónimo con vuelta a su resultado', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession());

    await renderPage({ s: SESSION_TOKEN });

    const cta = screen.getByRole('link', { name: 'Create an account' });
    expect(cta).toHaveAttribute(
      'href',
      `/en/register?redirect=${encodeURIComponent(
        `/en/quiz/space-trivia/result?s=${SESSION_TOKEN}`
      )}`
    );
    // Y se puede descartar sin bloquear nada.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
  });

  it('una partida anónima no muestra puntos: muestra el aviso de cuenta', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession({ player_id: null }));

    await renderPage({ s: SESSION_TOKEN });

    expect(screen.getByText('Points are saved with an account')).toBeInTheDocument();
    expect(screen.queryByText('+10')).not.toBeInTheDocument();
  });

  it('a un usuario con sesión no le ofrece registrarse y ve sus puntos', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(makeSession({ player_id: 'user-1' }));
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    await renderPage({ s: SESSION_TOKEN });

    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument();
    // 7/8 no es partida perfecta: 10 puntos.
    expect(screen.getByText('+10')).toBeInTheDocument();
  });

  it('una partida perfecta de jugador muestra los 35 puntos del trigger', async () => {
    mocks.getQuizSessionByShareToken.mockResolvedValue(
      makeSession({ player_id: 'user-1', score: 8, max_score: 8 })
    );
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    await renderPage({ s: SESSION_TOKEN });

    expect(screen.getByText('+35')).toBeInTheDocument();
  });
});
