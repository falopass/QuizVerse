import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  order: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

import AchievementsPage from '@/app/[locale]/achievements/page';

const USER = { id: 'user-1' };
const ROWS = [
  {
    achievement_id: 'first_quiz',
    unlocked_at: '2026-10-01T12:00:00Z',
    achievements: {
      id: 'first_quiz',
      name: 'First Steps',
      description: 'Complete your first quiz',
      icon: '🎯',
      points_reward: 10,
      condition_type: 'plays',
      condition_value: 1,
    },
  },
  {
    achievement_id: 'perfect_score',
    unlocked_at: '2026-10-10T12:00:00Z',
    achievements: {
      id: 'perfect_score',
      name: 'Flawless',
      description: 'Get a perfect score on any quiz',
      icon: '💎',
      points_reward: 25,
      condition_type: 'score',
      condition_value: 100,
    },
  },
];

function props(locale = 'es') {
  return { params: Promise.resolve({ locale }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.order.mockResolvedValue({ data: ROWS, error: null });
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ order: mocks.order }) }),
  });
});

describe('página /achievements', () => {
  it('sin sesión redirige a login con redirect de vuelta', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(AchievementsPage(props('es'))).rejects.toThrow(
      `NEXT_REDIRECT:/es/login?redirect=${encodeURIComponent('/es/achievements')}`
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('con sesión lista los logros desbloqueados con su nombre', async () => {
    render(await AchievementsPage(props('es')));

    expect(screen.getByRole('heading', { name: 'Mis logros' })).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('Flawless')).toBeInTheDocument();
  });

  it('sin filas muestra el estado vacío', async () => {
    mocks.order.mockResolvedValue({ data: [], error: null });

    render(await AchievementsPage(props('en')));

    expect(
      screen.getByRole('heading', { name: "You haven't unlocked any achievements yet" })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );
  });

  it('un error de Supabase muestra el estado vacío en vez de romper', async () => {
    mocks.order.mockResolvedValue({ data: null, error: { message: 'db down' } });

    render(await AchievementsPage(props('es')));

    expect(
      screen.getByRole('heading', { name: 'Aún no has desbloqueado logros' })
    ).toBeInTheDocument();
  });

  it('un locale desconocido devuelve 404', async () => {
    await expect(AchievementsPage(props('fr'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
