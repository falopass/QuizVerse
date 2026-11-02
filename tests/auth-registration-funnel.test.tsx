import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  signInAction: vi.fn(),
  signUpAction: vi.fn(),
  resendConfirmationAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/auth.actions', () => ({
  signInAction: mocks.signInAction,
  signUpAction: mocks.signUpAction,
  resendConfirmationAction: mocks.resendConfirmationAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { Footer } from '@/components/layout/footer';
import { getDictionary } from '@/lib/i18n/dictionaries';

const LABELS = {
  email: 'Correo electrónico',
  password: 'Contraseña',
  name: 'Nombre',
  submit: 'Crear cuenta',
};

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/contraseña|password/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/email|correo/i), { target: { value: email } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signInAction.mockResolvedValue({ ok: true, userId: 'u1' });
  mocks.signUpAction.mockResolvedValue({ ok: true, userId: 'u1' });
  mocks.resendConfirmationAction.mockResolvedValue({ ok: true, userId: null });
});

describe('enlaces a /register (F02)', () => {
  it('el login enlaza a crear cuenta conservando ?redirect=', () => {
    render(<LoginForm locale="es" redirectTo="/es/create" />);

    const link = screen.getByRole('link', { name: 'Crea una' });
    expect(link).toHaveAttribute('href', '/es/register?redirect=%2Fes%2Fcreate');
    expect(screen.getByText('¿No tienes cuenta?')).toBeInTheDocument();
  });

  it('el footer enlaza a /register junto a login', async () => {
    const dictionary = await getDictionary('es');
    render(<Footer dictionary={dictionary} locale="es" />);

    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/es/register'
    );
  });

  it('el footer en inglés enlaza a /en/register', async () => {
    const dictionary = await getDictionary('en');
    render(<Footer dictionary={dictionary} locale="en" />);

    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/en/register');
  });
});

describe('pantalla post-registro sin sesión (AB-12)', () => {
  it('muestra «revisa tu correo» y no redirige cuando falta confirmar el email', async () => {
    mocks.signUpAction.mockResolvedValue({ ok: true, userId: 'u1', needsEmailConfirmation: true });
    render(<RegisterForm labels={LABELS} redirectTo="/es" locale="es" />);

    fillAndSubmit('nueva@example.com', 'x');
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeInTheDocument());
    expect(screen.getByText('nueva@example.com')).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.signUpAction).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'nueva@example.com', locale: 'es' })
    );
  });

  it('el botón reenviar llama a resendConfirmationAction y avisa', async () => {
    mocks.signUpAction.mockResolvedValue({ ok: true, userId: 'u1', needsEmailConfirmation: true });
    render(<RegisterForm labels={LABELS} redirectTo="/es" locale="es" />);

    fillAndSubmit('nueva@example.com', 'x');
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo' }));

    await waitFor(() =>
      expect(screen.getByText('Enviado — revisa tu bandeja de entrada.')).toBeInTheDocument()
    );
    expect(mocks.resendConfirmationAction).toHaveBeenCalledWith({
      email: 'nueva@example.com',
      locale: 'es',
    });
  });

  it('con sesión (needsEmailConfirmation falso) sigue redirigiendo', async () => {
    render(<RegisterForm labels={LABELS} redirectTo="/es" locale="es" />);

    fillAndSubmit('nueva@example.com', 'x');
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/es'));
  });
});

describe('email_not_confirmed en el login ofrece reenvío', () => {
  it('muestra el aviso con botón de reenvío', async () => {
    mocks.signInAction.mockResolvedValue({ ok: false, code: 'email_not_confirmed' });
    render(<LoginForm locale="es" redirectTo="/es" />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'x'.repeat(9) } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo' }));
    await waitFor(() =>
      expect(mocks.resendConfirmationAction).toHaveBeenCalledWith({
        email: 'a@b.com',
        locale: 'es',
      })
    );
  });
});
