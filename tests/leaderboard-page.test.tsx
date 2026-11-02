/**
 * Tests de `/{locale}/leaderboard`: el tablero global.
 *
 * Contrato: un ranking vacío muestra un estado vacío honesto con CTA a jugar
 * («Be the first on the board»), no solo un «0 players» y nada más; y la
 * tarjeta de login solo aparece cuando hay un tablero real en el que caer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getLeaderboard: vi.fn(),
  getWeeklyLeaderboard: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: vi.fn(() => {
      throw new Error('from() no debería llamarse en el tablero global');
    }),
  })),
}));

vi.mock('@/lib/data/public', () => ({
  getLeaderboard: mocks.getLeaderboard,
}));

vi.mock('@/lib/profile/weekly-ranking', () => ({
  getWeeklyLeaderboard: mocks.getWeeklyLeaderboard,
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
  mocks.getLeaderboard.mockReset().mockResolvedValue([]);
  mocks.getWeeklyLeaderboard.mockReset().mockResolvedValue([]);
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
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
    mocks.getLeaderboard.mockResolvedValue([
      { rank: 1, user: player(), points: 120, quizzesPlayed: 9 },
    ]);

    await renderPage('en');

    expect(screen.getByText('Pixel Pro')).toBeInTheDocument();
    expect(screen.queryByText('The board is empty.')).not.toBeInTheDocument();
  });
});
