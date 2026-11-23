/**
 * Cobertura de proveedores OAuth y botones sociales detrás de
 * `AUTH_OAUTH_PROVIDERS` (Google, Facebook y GitHub; hallazgos C-07 y D-14).
 */

import React from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OAuthSignInResult } from '@/actions/auth.actions';

const mocks = vi.hoisted(() => ({
  signInWithOAuthAction: vi.fn<() => Promise<OAuthSignInResult>>(),
}));

vi.mock('@/actions/auth.actions', () => ({
  signInWithOAuthAction: mocks.signInWithOAuthAction,
}));

import { enabledOAuthProviders } from '@/lib/auth/oauth-providers';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

const PROVIDERS_ENV = 'AUTH_OAUTH_PROVIDERS';
const savedEnv = process.env[PROVIDERS_ENV];

function setProvidersEnv(value?: string) {
  if (value === undefined) delete process.env[PROVIDERS_ENV];
  else process.env[PROVIDERS_ENV] = value;
}

beforeEach(() => {
  setProvidersEnv(undefined);
  mocks.signInWithOAuthAction.mockReset();
});

afterAll(() => setProvidersEnv(savedEnv));

describe('enabledOAuthProviders', () => {
  it('devuelve [] cuando la variable falta o está vacía (cero botones rotos)', () => {
    expect(enabledOAuthProviders()).toEqual([]);

    setProvidersEnv('   ');
    expect(enabledOAuthProviders()).toEqual([]);
  });

  it('admite google, facebook y github manteniendo el orden estable del esquema', () => {
    setProvidersEnv('github, facebook, google');
    expect(enabledOAuthProviders()).toEqual(['google', 'facebook', 'github']);
  });

  it('omite facebook cuando solo están configurados google y github', () => {
    setProvidersEnv('google,github');
    expect(enabledOAuthProviders()).toEqual(['google', 'github']);
  });

  it('ignora mayúsculas, espacios, duplicados y proveedores desconocidos', () => {
    setProvidersEnv(' FACEBOOK , google , myspace , facebook , ');
    expect(enabledOAuthProviders()).toEqual(['google', 'facebook']);
  });
});

describe('OAuthButtons', () => {
  it('no renderiza ningún botón cuando la lista de proveedores está vacía', () => {
    const { container } = render(
      React.createElement(OAuthButtons, {
        locale: 'es',
        redirectTo: '/es',
        providers: [],
      })
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('muestra Google y GitHub sin botón roto de Facebook cuando falta Facebook en el flag', () => {
    render(
      React.createElement(OAuthButtons, {
        locale: 'es',
        redirectTo: '/es',
        providers: ['google', 'github'],
      })
    );

    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Facebook/i })).not.toBeInTheDocument();
  });

  it('muestra Facebook junto a Google y GitHub en ES y EN cuando está habilitado', () => {
    const { rerender } = render(
      React.createElement(OAuthButtons, {
        locale: 'es',
        redirectTo: '/es',
        providers: ['google', 'facebook', 'github'],
      })
    );

    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con GitHub' })).toBeInTheDocument();

    rerender(
      React.createElement(OAuthButtons, {
        locale: 'en',
        redirectTo: '/en',
        providers: ['google', 'facebook', 'github'],
      })
    );

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
  });

  it('al pulsar Facebook invoca signInWithOAuthAction y muestra error localizado si falla', async () => {
    mocks.signInWithOAuthAction.mockResolvedValue({ ok: false, code: 'provider_disabled' });

    render(
      React.createElement(OAuthButtons, {
        locale: 'es',
        redirectTo: '/es/create',
        providers: ['google', 'facebook', 'github'],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Facebook' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ese método de acceso no está disponible por ahora.'
      )
    );
    expect(mocks.signInWithOAuthAction).toHaveBeenCalledWith({
      provider: 'facebook',
      next: '/es/create',
    });
  });
});
