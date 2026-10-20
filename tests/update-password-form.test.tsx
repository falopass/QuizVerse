import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthResult } from '@/lib/auth/identity';

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn<() => Promise<AuthResult>>(),
  changePassword: vi.fn<() => Promise<AuthResult>>(),
}));

vi.mock('@/actions/auth.actions', () => ({
  resetPasswordAction: mocks.resetPassword,
  changePasswordAction: mocks.changePassword,
}));

import { UpdatePasswordForm } from '@/components/auth/update-password-form';

function fillNewPasswords(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: confirm } });
}

beforeEach(() => {
  mocks.resetPassword.mockReset();
  mocks.changePassword.mockReset();
});

describe('UpdatePasswordForm · recovery', () => {
  it('no llama a la acción si la confirmación no coincide', async () => {
    render(<UpdatePasswordForm locale="es" mode="recovery" />);

    fillNewPasswords('claveNueva1', 'claveDistinta');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() =>
      expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    );
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('confirma y ofrece seguir a la home cuando el servidor actualiza', async () => {
    mocks.resetPassword.mockResolvedValue({ ok: true, userId: 'u1' });
    render(<UpdatePasswordForm locale="es" mode="recovery" />);

    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() => expect(screen.getByText('Contraseña actualizada')).toBeInTheDocument());
    expect(mocks.resetPassword).toHaveBeenCalledWith({ password: 'claveNueva1' });
    expect(screen.getByRole('link', { name: 'Ir a QuizVerse' })).toHaveAttribute('href', '/es');
  });

  it('avisa que se cerraron las otras sesiones cuando el servidor lo confirma', async () => {
    mocks.resetPassword.mockResolvedValue({ ok: true, userId: 'u1', revokedOtherSessions: true });
    render(<UpdatePasswordForm locale="es" mode="recovery" />);

    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() =>
      expect(screen.getByText(/cerramos las de los otros dispositivos/i)).toBeInTheDocument()
    );
  });

  it('avisa que el enlace venció cuando no hay sesión de recuperación', async () => {
    mocks.resetPassword.mockResolvedValue({ ok: false, code: 'unauthorized' });
    render(<UpdatePasswordForm locale="es" mode="recovery" />);

    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() =>
      expect(screen.getByText('El enlace ya no sirve. Pide uno nuevo.')).toBeInTheDocument()
    );
  });
});

describe('UpdatePasswordForm · settings', () => {
  it('manda la clave actual cuando la cuenta la requiere', async () => {
    mocks.changePassword.mockResolvedValue({ ok: true, userId: 'u1' });
    render(<UpdatePasswordForm locale="es" mode="settings" requireCurrent />);

    fireEvent.change(screen.getByLabelText('Contraseña actual'), {
      target: { value: 'claveVieja1' },
    });
    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() => expect(screen.getByText('Contraseña actualizada.')).toBeInTheDocument());
    expect(mocks.changePassword).toHaveBeenCalledWith({
      password: 'claveNueva1',
      currentPassword: 'claveVieja1',
    });
  });

  it('no pide clave actual ni la envía cuando la cuenta es solo OAuth', async () => {
    mocks.changePassword.mockResolvedValue({ ok: true, userId: 'u1' });
    render(<UpdatePasswordForm locale="es" mode="settings" />);

    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument();
    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() =>
      expect(mocks.changePassword).toHaveBeenCalledWith({ password: 'claveNueva1' })
    );
  });

  it('avisa que se cerraron las otras sesiones cuando el servidor lo confirma', async () => {
    mocks.changePassword.mockResolvedValue({ ok: true, userId: 'u1', revokedOtherSessions: true });
    render(<UpdatePasswordForm locale="es" mode="settings" />);

    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() =>
      expect(
        screen.getByText('Contraseña actualizada. Cerramos las sesiones de los otros dispositivos.')
      ).toBeInTheDocument()
    );
  });

  it('marca la clave actual cuando el servidor la rechaza', async () => {
    mocks.changePassword.mockResolvedValue({ ok: false, code: 'invalid_credentials' });
    render(<UpdatePasswordForm locale="es" mode="settings" requireCurrent />);

    fireEvent.change(screen.getByLabelText('Contraseña actual'), {
      target: { value: 'claveMala1' },
    });
    fillNewPasswords('claveNueva1', 'claveNueva1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() =>
      expect(screen.getByText('La contraseña actual no es correcta.')).toBeInTheDocument()
    );
  });
});
