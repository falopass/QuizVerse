import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  user: { id: 'admin-1' } as { id: string } | null,
  isAdmin: true,
  hasServiceKey: true,
  loadStats: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: async () => ({
    supabase: {},
    user: mocks.user,
    isAdmin: mocks.isAdmin,
  }),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => (mocks.hasServiceKey ? {} : null),
}));

vi.mock('@/lib/admin/stats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/stats')>();
  return { ...actual, loadAdminStats: mocks.loadStats };
});

import AdminStatsPage from '@/app/[locale]/admin/estadisticas/page';
import type { AdminStats } from '@/lib/admin/stats';

const STATS: AdminStats = {
  generatedAt: '2026-11-04T15:00:00Z',
  catalog: {
    published: 2,
    truncated: false,
    byLanguage: [
      { key: 'es', count: 1, share: 0.5 },
      { key: 'en', count: 1, share: 0.5 },
    ],
    byType: [{ key: 'trivia', count: 2, share: 1 }],
    byCategory: [
      { key: 'Cine', count: 1, share: 0.5 },
      { key: null, count: 1, share: 0.5 },
    ],
  },
  sessions: {
    daily: [
      { date: '2026-11-03', total: 1, registered: 1, anonymous: 0 },
      { date: '2026-11-04', total: 2, registered: 1, anonymous: 1 },
    ],
    windowDays: 30,
    windowTotal: 3,
    windowRegistered: 2,
    windowAnonymous: 1,
    truncated: false,
    allTimeTotal: 100,
    allTimeRegistered: 40,
    allTimeAnonymous: 60,
  },
  top: {
    byPlays: [{ title: 'Trivia de cine', slug: 'es-trivia-de-cine', language: 'es', value: 42 }],
    byShares: [{ title: 'Music poll', slug: 'en-music-poll', language: 'en', value: 9 }],
    byLikes: [],
  },
  accounts: { profilesTotal: 500, profilesNew7d: 12, profilesNew30d: 50 },
  community: { commentsTotal: 33, pendingQuizReports: 7, pendingCommentReports: null },
};

const renderPage = (locale: 'es' | 'en' = 'es') =>
  AdminStatsPage({ params: Promise.resolve({ locale }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'admin-1' };
  mocks.isAdmin = true;
  mocks.hasServiceKey = true;
  mocks.loadStats.mockResolvedValue(STATS);
});

describe('página /admin/estadisticas', () => {
  it('redirige a login sin sesión', async () => {
    mocks.user = null;
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/es/login');
  });

  it('devuelve 404 a un usuario que no es admin', async () => {
    mocks.isAdmin = false;
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.loadStats).not.toHaveBeenCalled();
  });

  it('muestra el estado de error sin service key o si la carga falla', async () => {
    mocks.hasServiceKey = false;
    render(await renderPage());
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las estadísticas');
    expect(mocks.loadStats).not.toHaveBeenCalled();

    mocks.hasServiceKey = true;
    mocks.loadStats.mockRejectedValue(new Error('boom'));
    render(await renderPage());
    expect(screen.getAllByRole('alert')[1]).toHaveTextContent('No pudimos cargar las estadísticas');
  });

  it('renderiza KPIs, serie diaria, tops y catálogo sin PII', async () => {
    const { container } = render(await renderPage());

    expect(screen.getByRole('heading', { name: 'Estadísticas del sitio' })).toBeInTheDocument();
    expect(screen.getByText('Partidas por día')).toBeInTheDocument();
    // Tabla de la serie (accesible) con totales y split registrado/anónimo.
    expect(screen.getByText('2026-11-04')).toBeInTheDocument();
    expect(screen.getByText(/3 partidas en la ventana/)).toBeInTheDocument();
    // Tops con título, slug, número y enlace localizado por idioma del quiz.
    expect(screen.getByRole('link', { name: /Trivia de cine/ })).toHaveAttribute(
      'href',
      '/es/quiz/es-trivia-de-cine'
    );
    expect(screen.getByText('es-trivia-de-cine')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    // Catálogo y cuentas.
    expect(screen.getByText('Cine')).toBeInTheDocument();
    expect(screen.getByText('Sin categoría')).toBeInTheDocument();
    expect(screen.getByText('Cuentas nuevas (7 días)')).toBeInTheDocument();
    // comment_reports sin migración se muestra como no disponible.
    expect(screen.getByText('Reportes de comentarios pendientes')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    // El HTML servido no lleva correos, usernames ni ids de usuario.
    expect(container.innerHTML).not.toMatch(/@|player_id|username|u-secret/);
  });

  it('renderiza en inglés', async () => {
    render(await renderPage('en'));
    expect(screen.getByRole('heading', { name: 'Site statistics' })).toBeInTheDocument();
    expect(screen.getByText('Most played')).toBeInTheDocument();
  });
});
