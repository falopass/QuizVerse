/**
 * F14: la pestaña semanal acepta `?tab=weekly` además del histórico
 * `?tab=semanal`, y el copy de la página sale del diccionario central.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getLeaderboard: vi.fn(),
  getWeeklyLeaderboard: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: vi.fn(),
  })),
}));

vi.mock('@/lib/data/public', () => ({
  getLeaderboard: mocks.getLeaderboard,
}));

vi.mock('@/lib/profile/weekly-ranking', () => ({
  getWeeklyLeaderboard: mocks.getWeeklyLeaderboard,
}));

import LocalizedLeaderboardPage from '@/app/[locale]/leaderboard/page';

async function renderPage(search: { scope?: string; tab?: string }, locale = 'es') {
  const element = await LocalizedLeaderboardPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(search),
  });
  return render(element);
}

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.getLeaderboard.mockReset();
  mocks.getWeeklyLeaderboard.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.getLeaderboard.mockResolvedValue([]);
  mocks.getWeeklyLeaderboard.mockResolvedValue([]);
});

describe('leaderboard: pestaña semanal', () => {
  it.each(['semanal', 'weekly'])('?tab=%s carga el ranking de los últimos 7 días', async (tab) => {
    await renderPage({ tab });

    expect(mocks.getWeeklyLeaderboard).toHaveBeenCalledTimes(1);
    expect(mocks.getLeaderboard).not.toHaveBeenCalled();
    expect(screen.getByText('Todavía nadie ha jugado esta semana.')).toBeInTheDocument();
  });

  it('sin tab carga el ranking global', async () => {
    await renderPage({});

    expect(mocks.getLeaderboard).toHaveBeenCalledTimes(1);
    expect(mocks.getWeeklyLeaderboard).not.toHaveBeenCalled();
  });

  it('el copy sale del diccionario en inglés', async () => {
    await renderPage({ tab: 'weekly' }, 'en');

    expect(screen.getByText('Nobody has played this week yet.')).toBeInTheDocument();
  });
});
