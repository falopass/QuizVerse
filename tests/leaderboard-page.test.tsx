/**
 * Tests de `/{locale}/leaderboard`: el tablero global.
 *
 * Contrato: un ranking vacío muestra un estado vacío honesto con CTA a jugar
 * («Be the first on the board»), no solo un «0 players» y nada más; y la
 * tarjeta de login solo aparece cuando hay un tablero real en el que caer y
 * no hay sesión (SOC-03: un jugador logueado fuera del top ve su puesto).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getLeaderboard: vi.fn(),
  getWeeklyLeaderboard: vi.fn(),
  getWeeklyRank: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

vi.mock('@/lib/data/public', () => ({
  getLeaderboard: mocks.getLeaderboard,
}));

vi.mock('@/lib/profile/weekly-ranking', () => ({
  getWeeklyLeaderboard: mocks.getWeeklyLeaderboard,
  getWeeklyRank: mocks.getWeeklyRank,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

import LocalizedLeaderboardPage from '@/app/[locale]/leaderboard/page';
import type { Profile } from '@/types/quiz';

const player = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  username: 'pixelpro',
  display_name: 'Pixel Pro',
  avatar_url: null,
  bio: null,
  points: 120,
  quizzes_played: 9,
  quizzes_created: 0,
  is_admin: false,
  is_verified: false,
  preferred_language: 'en',
  current_streak: 0,
  longest_streak: 0,
  last_played_on: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

function renderPage(locale = 'en', search: Record<string, string> = {}) {
  return LocalizedLeaderboardPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(search),
  }).then((jsx) => render(jsx));
}

beforeEach(() => {
  mocks.getLeaderboard.mockReset().mockResolvedValue({ entries: [], hasMore: false });
  mocks.getWeeklyLeaderboard.mockReset().mockResolvedValue({ entries: [], hasMore: false });
  mocks.getWeeklyRank.mockReset().mockResolvedValue(null);
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
  mocks.from.mockReset();
});

describe('LocalizedLeaderboardPage — tablero vacío', () => {
  it('muestra el estado vacío con CTA a jugar en vez de un «0 players» pelado', async () => {
    await renderPage('en');

    expect(screen.getByText('The board is empty.')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Be the first on the board' });
    expect(cta).toHaveAttribute('href', '/en/quiz');
    // La tarjeta de login no tiene sentido sin un tablero donde caer.
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('muestra el estado vacío en español', async () => {
    await renderPage('es');

    expect(screen.getByText('El tablero está vacío.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sé el primero del ranking' })).toHaveAttribute(
      'href',
      '/es/quiz'
    );
  });
});

describe('LocalizedLeaderboardPage — consulta caída', () => {
  it('un error de la consulta no se disfraza de tablero vacío', async () => {
    mocks.getLeaderboard.mockRejectedValue(new Error('supabase down'));

    await renderPage('en');

    expect(screen.getByText('We could not load the leaderboard.')).toBeInTheDocument();
    expect(screen.queryByText('The board is empty.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/en/leaderboard'
    );
  });
});

describe('LocalizedLeaderboardPage — con jugadores', () => {
  it('pinta las filas del ranking y no el estado vacío', async () => {
    mocks.getLeaderboard.mockResolvedValue({
      entries: [{ rank: 1, user: player(), points: 120, quizzesPlayed: 9 }],
      hasMore: false,
    });

    await renderPage('en');

    expect(screen.getByText('Pixel Pro')).toBeInTheDocument();
    expect(screen.queryByText('The board is empty.')).not.toBeInTheDocument();
  });

  it('sin sesión y fuera del top ofrece iniciar sesión', async () => {
    mocks.getLeaderboard.mockResolvedValue({
      entries: [{ rank: 1, user: player(), points: 120, quizzesPlayed: 9 }],
      hasMore: false,
    });

    await renderPage('en');

    expect(screen.getByText('Sign in to see where you land.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/en/login?redirect=%2Fen%2Fleaderboard'
    );
  });

  it('con sesión fuera del top muestra el puesto real, nunca el CTA de login (SOC-03)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'me-1' } } });
    mocks.getLeaderboard.mockResolvedValue({
      entries: [{ rank: 1, user: player(), points: 120, quizzesPlayed: 9 }],
      hasMore: false,
    });
    // 1) puntos propios; 2) perfiles por delante con el desempate del board.
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('profiles');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { points: 10, quizzes_played: 2 }, error: null }),
          }),
          or: async () => ({ count: 60, error: null }),
        }),
      };
    });

    await renderPage('en');

    expect(screen.queryByText('Sign in to see where you land.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    // 60 jugadores por delante + 1 = #61: en la tarjeta y en la métrica.
    expect(screen.getAllByText('#61')).toHaveLength(2);
    expect(
      screen.getByText('Keep playing: the board moves with every finished quiz.')
    ).toBeInTheDocument();
  });
});

describe('LocalizedLeaderboardPage — amigos (SOC-07)', () => {
  it('sin seguir a nadie muestra solo el estado vacío, no la fila propia como #1', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'me-1' } } });
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('user_follows');
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    });

    await renderPage('en', { scope: 'friends' });

    expect(screen.getByText('You are not following anyone yet.')).toBeInTheDocument();
    expect(screen.queryByText('Pixel Pro')).not.toBeInTheDocument();
    expect(screen.getByText('Visible players').parentElement).toHaveTextContent('0');
  });
});
