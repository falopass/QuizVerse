import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useSupabase: vi.fn(),
  signOutAction: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}));

vi.mock('@/actions/auth.actions', () => ({
  signOutAction: mocks.signOutAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  usePathname: () => '/es',
}));

import { UserMenu, UserMenuMobile } from '@/components/layout/user-menu';
import { FloatingNav } from '@/components/layout/floating-nav';
import { getDictionary } from '@/lib/i18n/dictionaries';

const USER = {
  email: 'ada@example.com',
  user_metadata: { name: 'Ada' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOutAction.mockResolvedValue({ ok: true, userId: null });
  mocks.signOut.mockResolvedValue(undefined);
  mocks.useSupabase.mockReturnValue({ user: null, loading: false, signOut: mocks.signOut });
});

describe('UserMenu', () => {
  it('muestra un placeholder mientras carga, sin enlace ni botón', () => {
    mocks.useSupabase.mockReturnValue({ user: null, loading: true, signOut: mocks.signOut });

    const { container } = render(<UserMenu locale="es" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.firstChild).not.toBeNull();
  });

  it('sin sesión muestra el enlace de login localizado', () => {
    render(<UserMenu locale="es" />);

    const link = screen.getByRole('link', { name: 'Iniciar sesión' });
    expect(link).toHaveAttribute('href', '/es/login');
  });

  it('con sesión muestra el nombre y abre el menú con las dos opciones', () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });

    render(<UserMenu locale="es" />);
    const trigger = screen.getByRole('button', { name: /ada/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Ajustes' })).toHaveAttribute(
      'href',
      '/es/settings'
    );
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('con name en blanco cae a display_name antes que al email', () => {
    mocks.useSupabase.mockReturnValue({
      user: {
        email: 'ada@example.com',
        user_metadata: { name: '   ', display_name: 'Ada Lovelace' },
      },
      loading: false,
      signOut: mocks.signOut,
    });

    render(<UserMenu locale="es" />);

    expect(screen.getByRole('button', { name: /ada lovelace/i })).toBeInTheDocument();
  });

  it('sin nombre en metadata usa la parte local del email, nunca el email completo', () => {
    mocks.useSupabase.mockReturnValue({
      user: { email: 'ada@example.com', user_metadata: {} },
      loading: false,
      signOut: mocks.signOut,
    });

    render(<UserMenu locale="es" />);

    expect(screen.getByRole('button', { name: 'ada' })).toBeInTheDocument();
    expect(screen.queryByText(/ada@example\.com/)).not.toBeInTheDocument();
  });

  it('cierra el menú con Escape y devuelve el foco al botón', () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });

    render(<UserMenu locale="es" />);
    const trigger = screen.getByRole('button', { name: /ada/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('cierra el menú al hacer clic fuera', () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });

    render(<UserMenu locale="es" />);
    fireEvent.click(screen.getByRole('button', { name: /ada/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('cerrar sesión llama a la action, limpia el provider y navega a la home localizada', async () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });

    render(<UserMenu locale="es" />);
    fireEvent.click(screen.getByRole('button', { name: /ada/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es'));
    expect(mocks.signOutAction).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('UserMenuMobile', () => {
  it('sin sesión muestra solo el enlace de login', () => {
    render(<UserMenuMobile locale="en" />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/login');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('con sesión muestra Ajustes y Cerrar sesión', async () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });
    const onSelect = vi.fn();

    render(<UserMenuMobile locale="es" onSelect={onSelect} />);

    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/es/settings');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es'));
    expect(mocks.signOutAction).toHaveBeenCalledTimes(1);
  });
});

describe('FloatingNav', () => {
  it('sin sesión muestra «Iniciar sesión» en la cabecera y en el menú móvil', async () => {
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/es/login'
    );

    fireEvent.click(screen.getByRole('button', { name: /menú/i }));
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })).toHaveLength(2);
  });

  it('con sesión monta el menú de usuario y las entradas del menú móvil', async () => {
    mocks.useSupabase.mockReturnValue({ user: USER, loading: false, signOut: mocks.signOut });
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    expect(screen.getByRole('button', { name: /ada/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /menú/i }));
    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/es/settings');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
