import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  pathname: '/es',
  useSupabase: vi.fn(),
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

import { FloatingNav } from '@/components/layout/floating-nav';
import { getDictionary } from '@/lib/i18n/dictionaries';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/es';
  mocks.useSupabase.mockReturnValue({ user: null, loading: false, signOut: mocks.signOut });
});

describe('FloatingNav marca la página activa', () => {
  it('en /es/quiz marca Explorar con aria-current="page" y los demás sin él', async () => {
    mocks.pathname = '/es/quiz';
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    const explore = screen.getByRole('link', { name: dictionary.common.explore });
    expect(explore).toHaveAttribute('aria-current', 'page');

    const personality = screen.getByRole('link', { name: /personalidad/i });
    const trivia = screen.getByRole('link', { name: /trivia/i });
    expect(personality).not.toHaveAttribute('aria-current');
    expect(trivia).not.toHaveAttribute('aria-current');
  });

  it('en /es/category/personality marca Personalidad y no Explorar', async () => {
    mocks.pathname = '/es/category/personality';
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    expect(screen.getByRole('link', { name: /personalidad/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: dictionary.common.explore })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('en /en/category/trivia marca Trivia en inglés', async () => {
    mocks.pathname = '/en/category/trivia';
    const dictionary = await getDictionary('en');
    render(<FloatingNav locale="en" dictionary={dictionary} />);

    expect(screen.getByRole('link', { name: /trivia/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: dictionary.common.explore })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('en el menú hamburguesa abierto también marca la página activa', async () => {
    mocks.pathname = '/es/category/personality';
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    fireEvent.click(screen.getByRole('button', { name: /menú/i }));

    const menu = document.getElementById('arcade-mobile-menu');
    expect(menu).not.toBeNull();
    const links = menu!.querySelectorAll('a');
    const personality = Array.from(links).find((a) => /personalidad/i.test(a.textContent ?? ''));
    const explore = Array.from(links).find(
      (a) => (a.textContent ?? '').trim() === dictionary.common.explore
    );
    expect(personality).toBeDefined();
    expect(explore).toBeDefined();
    expect(personality).toHaveAttribute('aria-current', 'page');
    expect(explore).not.toHaveAttribute('aria-current');
  });

  it('en /es/leaderboard ningún enlace de la navegación lleva aria-current', async () => {
    mocks.pathname = '/es/leaderboard';
    const dictionary = await getDictionary('es');
    render(<FloatingNav locale="es" dictionary={dictionary} />);

    const nav = screen.getByRole('navigation', { name: dictionary.arcade.mainNavigation });
    nav.querySelectorAll('a').forEach((link) => {
      expect(link).not.toHaveAttribute('aria-current');
    });
  });
});
