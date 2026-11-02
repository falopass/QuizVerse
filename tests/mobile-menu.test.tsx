/**
 * Menú móvil del shell: dos grupos separados (navegación y cuenta), el
 * selector de idioma al pie, y cierre con Escape (devolviendo el foco al
 * botón), al elegir un ítem o al navegar.
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  pathname: '/es',
  useSupabase: vi.fn(),
  signOutAction: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}));

vi.mock('@/actions/auth.actions', () => ({
  signOutAction: mocks.signOutAction,
}));

import { FloatingNav } from '@/components/layout/floating-nav';
import { getDictionary } from '@/lib/i18n/dictionaries';

const supabaseStub = {
  from: () => ({
    select: () => ({ eq: () => ({ eq: async () => ({ count: 0, error: null }) }) }),
  }),
};

function menu() {
  return document.getElementById('arcade-mobile-menu');
}

function menuButton() {
  return screen.getByRole('button', { name: 'Menú' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/es';
  mocks.useSupabase.mockReturnValue({
    getClient: async () => supabaseStub,
    user: null,
    loading: false,
    signOut: mocks.signOut,
  });
});

describe('menú móvil', () => {
  it('agrupa navegación, cuenta y el selector de idioma al pie', async () => {
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    fireEvent.click(menuButton());
    const panel = menu()!;
    expect(panel).not.toBeNull();

    const nav = panel.querySelector('.arcade-mobile-menu-nav')!;
    expect(nav).not.toBeNull();
    for (const label of ['Explorar', 'Personalidad', 'Trivia', 'Ranking', 'Quiz al azar']) {
      expect(nav.textContent).toContain(label);
    }

    expect(panel.querySelector('.arcade-mobile-menu-account')).not.toBeNull();

    const locale = panel.querySelector('.arcade-mobile-menu-locale')!;
    expect(locale.querySelector('select')).not.toBeNull();
  });

  it('sin sesión muestra Entrar y Crear cuenta en el grupo de cuenta', async () => {
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    fireEvent.click(menuButton());

    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/es/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/es/register'
    );
  });

  it('con sesión muestra el nombre y los enlaces de cuenta en dos columnas', async () => {
    mocks.useSupabase.mockReturnValue({
      getClient: async () => supabaseStub,
      user: { email: 'ada@example.com', user_metadata: { name: 'Ada' } },
      loading: false,
      signOut: mocks.signOut,
    });
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    fireEvent.click(menuButton());
    const panel = menu()!;

    expect(panel.querySelector('.arcade-mobile-menu-user')?.textContent).toContain('Ada');
    const links = panel.querySelector('.arcade-mobile-menu-links')!;
    for (const label of [
      'Mi actividad',
      'Mi perfil',
      'Mis quizzes',
      'Crear con AI',
      'Mis logros',
      'Ajustes',
    ]) {
      expect(links.textContent).toContain(label);
    }
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('Escape cierra el menú y devuelve el foco al botón', async () => {
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    const button = menuButton();
    fireEvent.click(button);
    expect(menu()).not.toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(menu()).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('se cierra al elegir un ítem y al cambiar el pathname', async () => {
    const dictionary = await getDictionary('es');
    const { rerender } = render(<FloatingNav locale="es" dictionary={dictionary} />);

    fireEvent.click(menuButton());
    fireEvent.click(within(menu()!).getByRole('link', { name: 'Explorar' }));
    expect(menu()).toBeNull();

    fireEvent.click(menuButton());
    expect(menu()).not.toBeNull();
    mocks.pathname = '/es/leaderboard';
    rerender(<FloatingNav locale="es" dictionary={dictionary} />);
    expect(menu()).toBeNull();
  });
});
