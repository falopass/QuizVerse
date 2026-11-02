import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionEq: vi.fn(),
  sessionLimit: vi.fn(),
  profileMaybeSingle: vi.fn(),
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

import MePage from '@/app/[locale]/me/page';
import { todayInStreakZone } from '@/lib/quiz/streak';

const USER = { id: 'user-1' };
const ROWS = [
  {
    id: 'session-1',
    score: 8,
    max_score: 10,
    result_title: null,
    share_token: 'tok1',
    completed_at: '2026-10-20T12:00:00Z',
    quiz: {
      slug: 'geografia-mundial',
      title: 'Geografía mundial',
      language: 'es',
      quiz_type: 'trivia',
    },
  },
  {
    id: 'session-2',
    score: 0,
    max_score: 0,
    result_title: 'Eres un Jedi',
    share_token: 'tok2',
    completed_at: '2026-10-19T12:00:00Z',
    quiz: {
      slug: 'que-jedi-eres',
      title: '¿Qué Jedi eres?',
      language: 'es',
      quiz_type: 'personality',
    },
  },
];

function props(locale = 'es') {
  return { params: Promise.resolve({ locale }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.sessionLimit.mockResolvedValue({ data: ROWS, error: null });
  mocks.sessionEq.mockReturnValue({ order: () => ({ limit: mocks.sessionLimit }) });
  mocks.profileMaybeSingle.mockResolvedValue({
    data: {
      points: 145,
      quizzes_played: 12,
      current_streak: 4,
      longest_streak: 9,
      last_played_on: todayInStreakZone(),
    },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'game_sessions') {
      return { select: () => ({ eq: mocks.sessionEq }) };
    }
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ maybeSingle: mocks.profileMaybeSingle }) }) };
    }
    throw new Error(`tabla inesperada: ${table}`);
  });
});

describe('página /me', () => {
  it('sin sesión redirige a login con redirect de vuelta', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(MePage(props('es'))).rejects.toThrow(
      `NEXT_REDIRECT:/es/login?redirect=${encodeURIComponent('/es/me')}`
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('con sesión lista las partidas con puntaje, fecha y enlace a su resultado', async () => {
    render(await MePage(props('es')));

    expect(screen.getByRole('heading', { name: 'Mi actividad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /geografía mundial/i })).toHaveAttribute(
      'href',
      '/es/quiz/geografia-mundial/result?s=tok1'
    );
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('Eres un Jedi')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
  });

  it('muestra la racha actual y la mejor racha', async () => {
    render(await MePage(props('es')));

    expect(screen.getByText('Racha')).toBeInTheDocument();
    expect(screen.getByText('Racha').closest('div')).toHaveTextContent(/4\s*días/);
    expect(screen.getByText('Mejor racha: 9')).toBeInTheDocument();
  });

  it('una racha rota no se muestra como vigente', async () => {
    mocks.profileMaybeSingle.mockResolvedValue({
      data: {
        points: 145,
        quizzes_played: 12,
        current_streak: 4,
        longest_streak: 9,
        last_played_on: '2026-01-01',
      },
      error: null,
    });

    render(await MePage(props('es')));

    expect(screen.getByText('Racha').closest('div')).toHaveTextContent(/0\s*días/);
    expect(screen.getByText('Mejor racha: 9')).toBeInTheDocument();
  });

  it('sin la migración 018 reintenta sin racha y conserva los totales', async () => {
    mocks.profileMaybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'column does not exist' } })
      .mockResolvedValueOnce({ data: { points: 145, quizzes_played: 12 }, error: null });

    render(await MePage(props('es')));

    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('Racha').closest('div')).toHaveTextContent(/0\s*días/);
    expect(screen.getByText('Mejor racha: 0')).toBeInTheDocument();
  });

  it('la consulta pide solo las partidas propias con tope de 30', async () => {
    render(await MePage(props('en')));

    expect(mocks.sessionEq).toHaveBeenCalledWith('player_id', 'user-1');
    expect(mocks.sessionLimit).toHaveBeenCalledWith(30);
  });

  it('sin partidas muestra el estado vacío con CTA a jugar', async () => {
    mocks.sessionLimit.mockResolvedValue({ data: [], error: null });

    render(await MePage(props('en')));

    expect(screen.getByRole('heading', { name: "You haven't played yet" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );
  });

  it('un fallo de consulta muestra aviso con reintento, no el estado vacío', async () => {
    mocks.sessionLimit.mockResolvedValue({ data: null, error: { message: 'db down' } });

    render(await MePage(props('es')));

    expect(
      screen.getByRole('heading', { name: 'No pudimos cargar tu historial' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reintentar' })).toHaveAttribute('href', '/es/me');
    expect(screen.queryByRole('heading', { name: 'Aún no has jugado' })).not.toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('un locale desconocido devuelve 404', async () => {
    await expect(MePage(props('fr'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
