import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useSupabase: vi.fn(),
  count: 0 as number | null,
  error: null as { message: string } | null,
  eqUser: vi.fn(),
  eqRead: vi.fn(),
  selectSpy: vi.fn(),
}));

vi.mock('@/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/es',
}));

import { NotificationBell } from '@/components/layout/notification-bell';
import { useNotificationBadge } from '@/stores/notification-store';

const USER = { id: 'user-1', email: 'ada@example.com', user_metadata: {} };

function supabaseStub() {
  return {
    from: (table: string) => {
      if (table !== 'notifications') throw new Error(`unexpected table ${table}`);
      return {
        select: (...args: unknown[]) => {
          mocks.selectSpy(...args);
          return {
            eq: (column: string, value: unknown) => {
              mocks.eqUser(column, value);
              return {
                eq: (column2: string, value2: unknown) => {
                  mocks.eqRead(column2, value2);
                  return Promise.resolve({ count: mocks.count, error: mocks.error });
                },
              };
            },
          };
        },
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.count = 0;
  mocks.error = null;
  useNotificationBadge.setState({ unread: null });
  mocks.useSupabase.mockReturnValue({
    supabase: supabaseStub(),
    user: USER,
    loading: false,
    signOut: vi.fn(),
  });
});

describe('NotificationBell', () => {
  it('sin sesión no renderiza nada', () => {
    mocks.useSupabase.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });

    const { container } = render(<NotificationBell locale="es" />);

    expect(container.firstChild).toBeNull();
  });

  it('con no leídas muestra el badge y el nombre accesible con el conteo', async () => {
    mocks.count = 3;

    render(<NotificationBell locale="es" />);

    const link = await screen.findByRole('link', { name: '3 notificaciones sin leer' });
    expect(link).toHaveAttribute('href', '/es/notifications');
    expect(link.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(mocks.eqRead).toHaveBeenCalledWith('is_read', false);
    expect(mocks.eqUser).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('sin no leídas no muestra badge numérico', async () => {
    mocks.count = 0;

    render(<NotificationBell locale="en" />);

    const link = await screen.findByRole('link', { name: 'Notifications' });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(link.textContent).not.toContain('0');
  });

  it('baja el conteo cuando el store decrementa', async () => {
    mocks.count = 2;

    render(<NotificationBell locale="en" />);
    await screen.findByRole('link', { name: '2 unread notifications' });

    React.act(() => useNotificationBadge.getState().decrementUnread());

    await waitFor(() =>
      expect(screen.getByRole('link', { name: '1 unread notification' })).toBeInTheDocument()
    );
  });
});
