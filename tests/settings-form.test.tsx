import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProfileActionResult } from '@/lib/profile/schema';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn<() => Promise<ProfileActionResult>>(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/profile.actions', () => ({
  updateProfileAction: mocks.updateProfile,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { SettingsForm } from '@/components/profile/settings-form';

const PROPS = {
  locale: 'es',
  initialDisplayName: 'Diego',
  initialUsername: 'diego_maule',
  initialBio: 'Bio inicial',
} as const;

beforeEach(() => {
  mocks.updateProfile.mockReset();
  mocks.refresh.mockReset();
});

describe('SettingsForm', () => {
  it('envía solo los campos modificados y confirma al guardar', async () => {
    mocks.updateProfile.mockResolvedValue({ ok: true });
    render(<SettingsForm {...PROPS} />);

    fireEvent.change(screen.getByLabelText('Nombre visible'), {
      target: { value: 'Diego Nuevo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByText('Perfil actualizado.')).toBeInTheDocument());
    expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Diego Nuevo' });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('marca el campo Usuario cuando el nombre ya está tomado', async () => {
    mocks.updateProfile.mockResolvedValue({
      ok: false,
      code: 'username_taken',
      fieldErrors: { username: ['taken'] },
    });
    render(<SettingsForm {...PROPS} />);

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'otro_usuario' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(screen.getByText('Ese usuario ya está en uso.')).toBeInTheDocument()
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('pinta los fieldErrors bajo cada campo cuando el input es inválido', async () => {
    mocks.updateProfile.mockResolvedValue({
      ok: false,
      code: 'invalid_input',
      fieldErrors: { displayName: ['too_small'], bio: ['too_big'] },
    });
    render(<SettingsForm {...PROPS} />);

    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Nueva bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(screen.getByText('Entre 1 y 60 caracteres.')).toBeInTheDocument();
      expect(screen.getByText('Máximo 280 caracteres.')).toBeInTheDocument();
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('avisa cuando no hay cambios que guardar', async () => {
    mocks.updateProfile.mockResolvedValue({ ok: false, code: 'empty' });
    render(<SettingsForm {...PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(screen.getByText('No hay cambios que guardar.')).toBeInTheDocument()
    );
    expect(mocks.updateProfile).toHaveBeenCalledWith({});
  });
});
