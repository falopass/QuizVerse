import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
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

import ProfileIndexPage from '@/app/[locale]/profile/page';

const USER = { id: 'user-1' };

function props(locale = 'es') {
  return { params: Promise.resolve({ locale }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.maybeSingle.mockResolvedValue({ data: { username: 'ada_lovelace' }, error: null });
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
  });
});

describe('página /profile', () => {
  it('sin sesión redirige a login con redirect de vuelta', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(ProfileIndexPage(props('es'))).rejects.toThrow(
      `NEXT_REDIRECT:/es/login?redirect=${encodeURIComponent('/es/profile')}`
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('con sesión redirige al perfil público propio', async () => {
    await expect(ProfileIndexPage(props('en'))).rejects.toThrow(
      'NEXT_REDIRECT:/en/profile/ada_lovelace'
    );
  });

  it('sin fila de perfil cae a /me', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(ProfileIndexPage(props('es'))).rejects.toThrow('NEXT_REDIRECT:/es/me');
  });

  it('un error al leer el perfil muestra aviso con reintento, no /me', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });

    render(await ProfileIndexPage(props('es')));

    expect(
      screen.getByRole('heading', { name: 'No pudimos cargar tu perfil' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reintentar' })).toHaveAttribute('href', '/es/profile');
  });

  it('un locale desconocido devuelve 404', async () => {
    await expect(ProfileIndexPage(props('fr'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
