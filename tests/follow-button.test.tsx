/**
 * Botón Seguir: un fallo de la action ya no pasa en silencio (SOC-10).
 * El estado del botón se mantiene y se pinta el motivo localizado.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  toggleFollowAction: vi.fn(),
}));

vi.mock('@/actions/social.actions', () => ({
  toggleFollowAction: mocks.toggleFollowAction,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/profile/ada',
}));

import { FollowButton } from '@/components/profile/follow-button';

const TARGET = '3f8a2c5e-9b1d-4e7f-a2c3-d5e6f7a8b9c0';

beforeEach(() => {
  mocks.toggleFollowAction.mockReset();
});

describe('FollowButton', () => {
  it('al seguir con éxito cambia a «Siguiendo»', async () => {
    mocks.toggleFollowAction.mockResolvedValue({ ok: true });

    render(
      <FollowButton targetUserId={TARGET} initialFollowing={false} isAuthenticated locale="es" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('si la action falla por rate limit lo dice y no cambia el estado', async () => {
    mocks.toggleFollowAction.mockResolvedValue({ ok: false, code: 'rate_limited' });

    render(
      <FollowButton targetUserId={TARGET} initialFollowing={false} isAuthenticated locale="es" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vas muy rápido. Espera un momento y vuelve a intentarlo.'
    );
    expect(screen.getByRole('button', { name: 'Seguir' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('un error genérico también se avisa', async () => {
    mocks.toggleFollowAction.mockRejectedValue(new Error('network'));

    render(<FollowButton targetUserId={TARGET} initialFollowing isAuthenticated locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Following' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not update the follow. Please try again.'
    );
  });

  it('sin sesión es un enlace a login con vuelta al perfil', () => {
    render(
      <FollowButton
        targetUserId={TARGET}
        initialFollowing={false}
        isAuthenticated={false}
        locale="es"
      />
    );

    expect(screen.getByRole('link', { name: 'Seguir' })).toHaveAttribute(
      'href',
      '/es/login?redirect=%2Fes%2Fprofile%2Fada'
    );
  });
});
