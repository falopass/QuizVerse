import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  markAll: vi.fn(),
  markOne: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/notifications.actions', () => ({
  markAllNotificationsRead: mocks.markAll,
  markNotificationRead: mocks.markOne,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { NotificationList } from '@/components/notifications/notification-list';
import { useNotificationBadge } from '@/stores/notification-store';
import type { ResolvedNotification } from '@/lib/notifications/resolve';

function item(overrides: Partial<ResolvedNotification>): ResolvedNotification {
  return {
    id: 'n-1',
    type: 'comment',
    title: 'Stored English title',
    body: 'Stored English body',
    is_read: false,
    created_at: '2026-11-01T10:00:00Z',
    href: null,
    actorName: null,
    quizTitle: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markAll.mockResolvedValue({ success: true });
  mocks.markOne.mockResolvedValue({ success: true });
  useNotificationBadge.setState({ unread: 3 });
});

describe('NotificationList', () => {
  it('cada notificación enlaza a su destino y se marca leída al abrirla', async () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={2}
        notifications={[
          item({
            type: 'comment',
            href: '/es/quiz/hp-trivia#comment-c-1',
            actorName: 'Ada',
            quizTitle: 'HP Trivia',
          }),
          item({
            id: 'n-2',
            type: 'follow',
            href: '/es/profile/grace',
            actorName: 'Grace',
          }),
        ]}
      />
    );

    const commentLink = screen.getByRole('link', { name: /Nuevo comentario en tu quiz/ });
    expect(commentLink).toHaveAttribute('href', '/es/quiz/hp-trivia#comment-c-1');
    expect(commentLink.textContent).toContain('Ada comentó en "HP Trivia"');

    fireEvent.click(commentLink);

    expect(mocks.markOne).toHaveBeenCalledWith('n-1');
    await waitFor(() => expect(useNotificationBadge.getState().unread).toBe(2));
    expect(screen.getByRole('link', { name: /Nuevo seguidor/ })).toHaveAttribute(
      'href',
      '/es/profile/grace'
    );
  });

  it('si el marcado falla no descuenta el badge', async () => {
    mocks.markOne.mockResolvedValue({ success: false, code: 'unexpected', error: 'boom' });

    render(
      <NotificationList
        locale="es"
        unreadCount={3}
        notifications={[item({ href: '/es/quiz/x' })]}
      />
    );

    fireEvent.click(screen.getByRole('link'));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.markOne).toHaveBeenCalledWith('n-1');
    expect(useNotificationBadge.getState().unread).toBe(3);
  });

  it('una notificación ya leída no vuelve a marcarse', () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={0}
        notifications={[item({ is_read: true, href: '/es/quiz/x' })]}
      />
    );

    fireEvent.click(screen.getByRole('link'));

    expect(mocks.markOne).not.toHaveBeenCalled();
    expect(useNotificationBadge.getState().unread).toBe(3);
  });

  it('«marcar todas» llama a la action, pone el badge a 0 y refresca', async () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={4}
        notifications={[item({ href: '/es/quiz/x' })]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));

    await waitFor(() => expect(useNotificationBadge.getState().unread).toBe(0));
    expect(mocks.markAll).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('tipo desconocido: etiqueta genérica, texto guardado y sin enlace', () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={1}
        notifications={[
          item({
            type: 'comment_report',
            title: 'A comment was reported',
            body: 'Report reason: spam',
          }),
        ]}
      />
    );

    expect(screen.getByText('Aviso')).toBeInTheDocument();
    expect(screen.getByText('A comment was reported')).toBeInTheDocument();
    expect(screen.getByText('Report reason: spam')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('referencia borrada: conserva el cuerpo guardado en vez de valores genéricos', () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={2}
        notifications={[
          item({
            type: 'follow',
            body: 'Grace started following you',
            actorName: null,
          }),
          item({
            id: 'n-2',
            type: 'comment',
            body: 'Ada commented on "HP Trivia"',
            actorName: null,
            quizTitle: null,
          }),
        ]}
      />
    );

    expect(screen.getByText('Grace started following you')).toBeInTheDocument();
    expect(screen.getByText('Ada commented on "HP Trivia"')).toBeInTheDocument();
    expect(screen.queryByText(/Alguien/)).not.toBeInTheDocument();
  });

  it('referencia borrada sin cuerpo guardado cae en la plantilla genérica', () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={1}
        notifications={[
          item({
            type: 'comment',
            body: null,
            actorName: 'Ada',
            quizTitle: null,
          }),
        ]}
      />
    );

    expect(screen.getByText('Ada comentó en tu quiz')).toBeInTheDocument();
  });

  it('moderación: el cuerpo guardado manda aunque el quiz resuelva', () => {
    render(
      <NotificationList
        locale="es"
        unreadCount={1}
        notifications={[
          item({
            type: 'quiz_rejected',
            body: 'Tu quiz "Nuevo" fue rechazado. Motivo: spam',
            quizTitle: 'Nuevo',
          }),
        ]}
      />
    );

    expect(screen.getByText('Tu quiz "Nuevo" fue rechazado. Motivo: spam')).toBeInTheDocument();
  });

  it('en inglés el copy sale del diccionario en inglés', () => {
    render(
      <NotificationList
        locale="en"
        unreadCount={1}
        notifications={[item({ type: 'follow', href: '/en/profile/ada', actorName: 'Ada' })]}
      />
    );

    const link = screen.getByRole('link', { name: /New follower/ });
    expect(link.textContent).toContain('Ada started following you');
  });

  it('sin notificaciones muestra el estado vacío', () => {
    render(<NotificationList locale="es" unreadCount={0} notifications={[]} />);

    expect(screen.getByText(/Aún no tienes notificaciones/)).toBeInTheDocument();
  });
});
