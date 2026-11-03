/**
 * F07: `src/app/[locale]/error.tsx` usa el diccionario real en/es y queda
 * dentro del SiteShell; `src/app/error.tsx` sigue de último recurso con el
 * eyebrow localizado.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getErrorCopy } from '@/lib/i18n/dictionaries';

const mocks = vi.hoisted(() => ({ pathname: '/es/quiz/xyz' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

import LocalizedErrorPage from '@/app/[locale]/error';
import RootErrorPage from '@/app/error';

function boom() {
  return new Error('boom');
}

describe('[locale]/error', () => {
  it('renderiza el copy en español con enlaces localizados', () => {
    mocks.pathname = '/es/quiz/xyz';

    render(<LocalizedErrorPage error={boom()} reset={vi.fn()} />);

    expect(screen.getByText('Algo interrumpió el flujo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es');
    expect(screen.getByRole('link', { name: 'Explorar quizzes' })).toHaveAttribute(
      'href',
      '/es/quiz'
    );
  });

  it('renderiza el copy en inglés bajo /en', () => {
    mocks.pathname = '/en/quiz/xyz';

    render(<LocalizedErrorPage error={boom()} reset={vi.fn()} />);

    expect(screen.getByText('Something interrupted the flow.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/en');
  });

  it('el botón de reintento llama a reset', () => {
    mocks.pathname = '/es/quiz/xyz';
    const reset = vi.fn();

    render(<LocalizedErrorPage error={boom()} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('app/error (último recurso)', () => {
  it('usa el copy del diccionario según el pathname', () => {
    mocks.pathname = '/es';

    render(<RootErrorPage error={boom()} reset={vi.fn()} />, { container: document });

    expect(screen.getByText('Algo interrumpió el flujo.')).toBeInTheDocument();
  });

  it('cae al inglés en rutas sin prefijo de locale', () => {
    mocks.pathname = '/api/whatever';

    render(<RootErrorPage error={boom()} reset={vi.fn()} />, { container: document });

    expect(screen.getByText('Something interrupted the flow.')).toBeInTheDocument();
  });
});

describe('getErrorCopy', () => {
  it('tiene paridad en/es y cae al inglés con locales desconocidos', () => {
    expect(getErrorCopy('es').retry).toBe('Reintentar');
    expect(getErrorCopy('en').retry).toBe('Try again');
    expect(getErrorCopy('fr').retry).toBe('Try again');
  });
});
