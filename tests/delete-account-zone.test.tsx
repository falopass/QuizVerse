import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  replace: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@/actions/account.actions', () => ({ deleteAccountAction: mocks.deleteAccount }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/providers/toast-provider', () => ({ useToast: () => ({ success: mocks.success }) }));

import { DeleteAccountZone } from '@/components/profile/delete-account-zone';

const PROPS = {
  locale: 'es',
  hasEmailIdentity: true,
  confirmationTarget: 'diego',
  available: true,
} as const;

beforeEach(() => {
  mocks.deleteAccount.mockReset();
  mocks.replace.mockReset();
  mocks.success.mockReset();
});

describe('DeleteAccountZone', () => {
  it('sin service key muestra el correo de contacto y no ofrece el formulario', () => {
    render(<DeleteAccountZone {...PROPS} available={false} />);

    expect(screen.getByText('El borrado automático no está disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@quizverse.org' })).toHaveAttribute(
      'href',
      'mailto:hello@quizverse.org'
    );
    expect(screen.queryByRole('button', { name: 'Eliminar mi cuenta' })).not.toBeInTheDocument();
  });

  it('confirma en dos pasos: el primer botón solo revela el formulario', async () => {
    mocks.deleteAccount.mockResolvedValue({ ok: true });
    render(<DeleteAccountZone {...PROPS} />);

    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));

    const password = await screen.findByLabelText('Contraseña actual');
    fireEvent.change(password, { target: { value: 'claveVieja1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta definitivamente' }));

    await waitFor(() =>
      expect(mocks.deleteAccount).toHaveBeenCalledWith({ password: 'claveVieja1' })
    );
    expect(mocks.success).toHaveBeenCalledWith(
      'Cuenta eliminada',
      'Tu cuenta y tus datos se borraron. Cerramos tu sesión.'
    );
    expect(mocks.replace).toHaveBeenCalledWith('/es');
  });

  it('en cuentas solo-OAuth pide escribir el username', async () => {
    mocks.deleteAccount.mockResolvedValue({ ok: false, code: 'confirmation_mismatch' });
    render(<DeleteAccountZone {...PROPS} hasEmailIdentity={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    const input = await screen.findByLabelText('Escribe diego para confirmar');
    fireEvent.change(input, { target: { value: 'otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta definitivamente' }));

    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith({ confirmation: 'otro' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El texto no coincide con el dato de confirmación.'
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('muestra el error de contraseña incorrecta sin navegar', async () => {
    mocks.deleteAccount.mockResolvedValue({ ok: false, code: 'invalid_credentials' });
    render(<DeleteAccountZone {...PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), {
      target: { value: 'mala' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta definitivamente' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('La contraseña no es correcta.')
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
