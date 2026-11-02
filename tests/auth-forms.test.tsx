import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthResult } from '@/lib/auth/identity';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn<() => Promise<AuthResult>>(),
  signUp: vi.fn<() => Promise<AuthResult>>(),
  forgotPassword: vi.fn<() => Promise<AuthResult>>(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/auth.actions', () => ({
  signInAction: mocks.signIn,
  signUpAction: mocks.signUp,
  forgotPasswordAction: mocks.forgotPassword,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

const REGISTER_LABELS = {
  email: 'Correo electrónico',
  password: 'Contraseña',
  name: 'Nombre',
  submit: 'Crear cuenta',
};

beforeEach(() => {
  mocks.signIn.mockReset();
  mocks.signUp.mockReset();
  mocks.forgotPassword.mockReset();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
});

describe('LoginForm', () => {
  function fillAndSubmit(email = 'a@x.com', password = 'clave') {
    render(<LoginForm locale="es" redirectTo="/es/home" />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  }

  it('envía lo escrito y redirige al destino cuando entra', async () => {
    mocks.signIn.mockResolvedValue({ ok: true, userId: 'u1' });
    fillAndSubmit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/home'));
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'a@x.com', password: 'clave' });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('muestra el error localizado y no navega cuando falla', async () => {
    mocks.signIn.mockResolvedValue({ ok: false, code: 'invalid_credentials' });
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El correo o la contraseña no son correctos.'
      )
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe('RegisterForm', () => {
  function fillAndSubmit() {
    render(<RegisterForm labels={REGISTER_LABELS} redirectTo="/es/home" locale="es" />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Diego' } });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@x.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'claveSegura1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  }

  it('envía email, clave, nombre e idioma a la acción de alta', async () => {
    mocks.signUp.mockResolvedValue({ ok: true, userId: 'u1' });
    fillAndSubmit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es/home'));
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'a@x.com',
      password: 'claveSegura1',
      name: 'Diego',
      locale: 'es',
    });
  });

  it('muestra el error localizado cuando el email ya tiene cuenta', async () => {
    mocks.signUp.mockResolvedValue({ ok: false, code: 'email_taken' });
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ese correo ya tiene cuenta. Inicia sesión.'
      )
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe('ForgotPasswordForm', () => {
  function fillAndSubmit(email = 'a@x.com') {
    render(<ForgotPasswordForm locale="es" initialEmail={email} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
  }

  it('pide el enlace con el email y el idioma, y confirma el envío', async () => {
    mocks.forgotPassword.mockResolvedValue({ ok: true, userId: null });
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeInTheDocument());
    expect(mocks.forgotPassword).toHaveBeenCalledWith({ email: 'a@x.com', locale: 'es' });
  });

  it('ante invalid_input muestra su propio aviso de email, no el genérico', async () => {
    mocks.forgotPassword.mockResolvedValue({
      ok: false,
      code: 'invalid_input',
      fieldErrors: { email: ['invalid'] },
    });
    fillAndSubmit('mal');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo válido.')
    );
  });

  it('mapea un error de red de la acción a "unexpected" sin romper el formulario', async () => {
    mocks.forgotPassword.mockRejectedValue(new Error('network'));
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Algo salió mal. Inténtalo de nuevo en un momento.'
      )
    );
  });
});
