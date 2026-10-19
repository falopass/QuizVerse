import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  pathname: '/en/quiz/x',
  removeToast: vi.fn(),
  toasts: [
    {
      id: 't1',
      type: 'success' as const,
      title: 'Quiz guardado',
      description: 'Todo listo',
    },
  ],
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ toasts: mocks.toasts, removeToast: mocks.removeToast }),
}));

import { ToastViewport } from '@/components/ui/toast';

describe('ToastViewport a11y', () => {
  it('el contenedor es una región viva polite que anuncia los avisos', () => {
    const { container } = render(<ToastViewport />);
    const region = container.firstChild as HTMLElement;

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'false');
    expect(screen.getByText('Quiz guardado')).toBeInTheDocument();
  });

  it('el botón de cierre se llama "Dismiss notification" en /en', () => {
    mocks.pathname = '/en/quiz/x';
    render(<ToastViewport />);

    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('el botón de cierre se llama "Cerrar aviso" en /es', () => {
    mocks.pathname = '/es/quiz/x';
    render(<ToastViewport />);

    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument();
  });

  it('un segmento que empieza por /es no se confunde con el locale /es', () => {
    mocks.pathname = '/espanol/quiz/x';
    render(<ToastViewport />);

    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('el clic en el botón sigue cerrando el aviso', () => {
    mocks.pathname = '/en/quiz/x';
    render(<ToastViewport />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(mocks.removeToast).toHaveBeenCalledWith('t1');
  });
});
