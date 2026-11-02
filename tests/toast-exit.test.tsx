import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  pathname: '/en/quiz/x',
  removeToast: vi.fn(),
  toasts: [] as Array<{
    id: string;
    type: 'success';
    title: string;
    duration: number;
  }>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ toasts: mocks.toasts, removeToast: mocks.removeToast }),
}));

import { ToastViewport } from '@/components/ui/toast';

const liveToast = () => ({
  id: 't1',
  type: 'success' as const,
  title: 'Quiz guardado',
  duration: 5000,
});

beforeEach(() => {
  mocks.pathname = '/en/quiz/x';
  mocks.toasts = [liveToast()];
  mocks.removeToast.mockClear();
});

describe('ToastViewport con transiciones CSS', () => {
  it('entra con la animación de CSS', () => {
    const { container } = render(<ToastViewport />);

    expect(container.querySelector('.toast-item')).toBeInTheDocument();
    expect(container.querySelector('.toast-item-exit')).toBeNull();
    expect(screen.getByText('Quiz guardado')).toBeInTheDocument();
  });

  it('al cerrar avisa al provider y conserva el aviso hasta que termina la salida', () => {
    const { container, rerender } = render(<ToastViewport />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(mocks.removeToast).toHaveBeenCalledWith('t1');

    mocks.toasts = [];
    rerender(<ToastViewport />);

    const ghost = container.querySelector('.toast-item-exit');
    expect(ghost).toBeInTheDocument();
    expect(screen.getByText('Quiz guardado')).toBeInTheDocument();

    fireEvent.animationEnd(ghost as Element);
    expect(screen.queryByText('Quiz guardado')).not.toBeInTheDocument();
  });

  it('el fin de la animación de entrada no retira el aviso', () => {
    const { container } = render(<ToastViewport />);

    fireEvent.animationEnd(container.querySelector('.toast-item') as Element);

    expect(screen.getByText('Quiz guardado')).toBeInTheDocument();
  });

  it('el fin de la barra de progreso no retira el aviso', () => {
    const { container } = render(<ToastViewport />);

    fireEvent.animationEnd(container.querySelector('.toast-progress') as Element);

    expect(screen.getByText('Quiz guardado')).toBeInTheDocument();
  });

  it('sin duración no pinta la barra de progreso', () => {
    mocks.toasts = [{ ...liveToast(), duration: 0 }];
    const { container } = render(<ToastViewport />);

    expect(container.querySelector('.toast-progress')).toBeNull();
  });
});
