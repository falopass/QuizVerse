import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/es',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

import { SiteShell } from '@/components/layout/site-shell';
import { getDictionary } from '@/lib/i18n/dictionaries';

describe('Enlace de salto al contenido', () => {
  it('renderiza exactamente un enlace "Saltar al contenido" hacia #main-content', async () => {
    const dictionary = await getDictionary('es');
    render(
      <SiteShell locale="es" dictionary={dictionary}>
        <p>contenido</p>
      </SiteShell>
    );

    const links = screen.getAllByRole('link', { name: 'Saltar al contenido' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '#main-content');
    expect(document.getElementById('main-content')).not.toBeNull();
  });
});
