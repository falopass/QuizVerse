import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  pathname: '/en/quiz/x',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

import ErrorPage from '@/app/error';

describe('ErrorPage', () => {
  it('muestra el copy en inglés y enlaces /en en una ruta /en', () => {
    mocks.pathname = '/en/quiz/x';
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />);

    expect(
      screen.getByRole('heading', { name: 'Something interrupted the flow.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('link', { name: 'Browse quizzes' })).toHaveAttribute(
      'href',
      '/en/quiz'
    );
  });

  it('muestra el copy en español y enlaces /es en una ruta /es', () => {
    mocks.pathname = '/es/quiz/x';
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Algo interrumpió el flujo.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es');
    expect(screen.getByRole('link', { name: 'Explorar quizzes' })).toHaveAttribute(
      'href',
      '/es/quiz'
    );
  });

  it('usa inglés por defecto cuando la ruta no tiene prefijo /es', () => {
    mocks.pathname = '/';
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />);

    expect(
      screen.getByRole('heading', { name: 'Something interrupted the flow.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/en');
  });

  it('no confunde un segmento que empieza por /es con el locale /es', () => {
    mocks.pathname = '/espanol/quiz/x';
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />);

    expect(
      screen.getByRole('heading', { name: 'Something interrupted the flow.' })
    ).toBeInTheDocument();
  });
});
