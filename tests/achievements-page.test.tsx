import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  unlockedOrder: vi.fn(),
  catalogOrder: vi.fn(),
  profileMaybeSingle: vi.fn(),
  playedCategories: 3,
  unlockResult: false,
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
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

const row = (
  id: string,
  condition_type: string,
  condition_value: number,
  points_reward: number,
  name: string
) => ({
  id,
  name,
  description: `${name} description`,
  icon: 'target',
  points_reward,
  condition_type,
  condition_value,
});

const CATALOG = [
  row('first_quiz', 'plays', 1, 10, 'First Steps'),
  row('quiz_addict_10', 'plays', 10, 50, 'Quiz Addict'),
  row('quiz_master_50', 'plays', 50, 150, 'Quiz Master'),
  row('perfect_score', 'score', 100, 25, 'Flawless'),
  row('creator', 'creates', 1, 30, 'Quiz Creator'),
  row('going_viral', 'shares', 100, 50, 'Going Viral'),
  row('internet_famous', 'shares', 1000, 200, 'Internet Famous'),
  row('week_streak', 'streak', 7, 50, 'Streak Master'),
  row('explorer', 'categories', 5, 75, 'Explorer'),
  row('social_butterfly', 'shares', 10, 40, 'Social Butterfly'),
];

const UNLOCKED_ROWS = [
  {
    achievement_id: 'first_quiz',
    unlocked_at: '2026-10-01T12:00:00Z',
    achievements: CATALOG[0],
  },
];

function props(locale = 'es') {
  return { params: Promise.resolve({ locale }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.unlockedOrder.mockResolvedValue({ data: UNLOCKED_ROWS, error: null });
  mocks.catalogOrder.mockResolvedValue({ data: CATALOG, error: null });
  mocks.profileMaybeSingle.mockResolvedValue({
    data: {
      points: 120,
      quizzes_played: 49,
      quizzes_created: 0,
      current_streak: 4,
      longest_streak: 4,
    },
    error: null,
  });
  mocks.playedCategories = 3;
  mocks.unlockResult = false;
  mocks.rpc.mockImplementation(async (fn: string) =>
    fn === 'get_my_played_categories'
      ? { data: mocks.playedCategories, error: null }
      : { data: mocks.unlockResult, error: null }
  );
  mocks.from.mockImplementation((table: string) => {
    if (table === 'user_achievements') {
      return { select: () => ({ eq: () => ({ order: mocks.unlockedOrder }) }) };
    }
    if (table === 'achievements') {
      return { select: () => ({ order: mocks.catalogOrder }) };
    }
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ maybeSingle: mocks.profileMaybeSingle }) }) };
    }
    throw new Error(`tabla inesperada: ${table}`);
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

  it('con sesión lista desbloqueados y bloqueados con su progreso', async () => {
    render(await AchievementsPage(props('es')));

    expect(screen.getByRole('heading', { name: 'Mis logros' })).toBeInTheDocument();
    expect(screen.getByText('1 de 7 desbloqueados')).toBeInTheDocument();

    // Desbloqueado: nombre traducido y fecha, sin barra de progreso.
    expect(screen.getByText('Primeros pasos')).toBeInTheDocument();
    expect(screen.getByText(/^Desbloqueado el/)).toBeInTheDocument();

    // Bloqueados: progreso con el contador real.
    expect(screen.getByText('4/7 días')).toBeInTheDocument();
    expect(screen.getByText('49/50 partidas')).toBeInTheDocument();
    expect(screen.getByText('3/5 categorías')).toBeInTheDocument();
  });

  it('oculta los logros sin métrica fiable', async () => {
    render(await AchievementsPage(props('es')));

    expect(screen.queryByText('Viral')).not.toBeInTheDocument();
    expect(screen.queryByText('Famoso en internet')).not.toBeInTheDocument();
    expect(screen.queryByText('Mariposa social')).not.toBeInTheDocument();
  });

  it('en inglés usa el copy y las unidades en inglés', async () => {
    render(await AchievementsPage(props('en')));

    expect(screen.getByText('4/7 days')).toBeInTheDocument();
    expect(screen.getByText('3/5 categories')).toBeInTheDocument();
    expect(screen.getByText('1 of 7 unlocked')).toBeInTheDocument();
  });

  it('marca como bloqueado lo que aún no se desbloquea', async () => {
    render(await AchievementsPage(props('es')));

    expect(screen.getAllByText('Bloqueado')).toHaveLength(6);
  });

  it('concede con el RPC un logro cuyo contador ya cumple la meta', async () => {
    mocks.profileMaybeSingle.mockResolvedValue({
      data: {
        points: 0,
        quizzes_played: 60,
        quizzes_created: 0,
        current_streak: 1,
        longest_streak: 1,
      },
      error: null,
    });
    mocks.unlockedOrder.mockResolvedValue({ data: [], error: null });
    mocks.unlockResult = true;

    render(await AchievementsPage(props('es')));

    expect(mocks.rpc).toHaveBeenCalledWith('unlock_achievement', {
      p_achievement_id: 'quiz_master_50',
    });
    expect(screen.getByText('3 de 7 desbloqueados')).toBeInTheDocument();
    expect(screen.getAllByText('Bloqueado')).toHaveLength(4);
  });

  it('si no hay contadores, no pinta barras en cero', async () => {
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });

    render(await AchievementsPage(props('es')));

    expect(screen.queryByText('4/7 días')).not.toBeInTheDocument();
    expect(screen.queryByText('49/50 partidas')).not.toBeInTheDocument();
    expect(screen.getByText('Primeros pasos')).toBeInTheDocument();
  });

  it('si el catálogo falla, muestra al menos los logros ya ganados', async () => {
    mocks.catalogOrder.mockResolvedValue({ data: null, error: { message: 'db down' } });

    render(await AchievementsPage(props('es')));

    expect(screen.getByText('Primeros pasos')).toBeInTheDocument();
    expect(screen.queryByText('Maestro de quizzes')).not.toBeInTheDocument();
  });

  it('sin catálogo ni logros muestra el estado vacío', async () => {
    mocks.catalogOrder.mockResolvedValue({ data: null, error: { message: 'db down' } });
    mocks.unlockedOrder.mockResolvedValue({ data: [], error: null });

    render(await AchievementsPage(props('en')));

    expect(
      screen.getByRole('heading', { name: "You haven't unlocked any achievements yet" })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );
  });

  it('un locale desconocido devuelve 404', async () => {
    await expect(AchievementsPage(props('fr'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
