'use client';

/**
 * Lista de notificaciones propias.
 *
 * El servidor entrega las últimas 50 y el conteo real de no leídas; «marcar
 * todas» va a `markAllNotificationsRead` y la página se relee con
 * `router.refresh()`. Sin realtime ni sonido: es la página de lectura.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead } from '@/actions/notifications.actions';
import type { Locale } from '@/lib/i18n/dictionaries';
import { formatRelativeDate } from '@/lib/utils/format';
import type { Database } from '@/types/database';

type Notification = Pick<
  Database['public']['Tables']['notifications']['Row'],
  'id' | 'type' | 'title' | 'body' | 'is_read' | 'created_at'
>;

const COPY = {
  es: {
    markAll: 'Marcar todas como leídas',
    marking: 'Marcando…',
    unread: (n: number) => (n === 1 ? '1 sin leer' : `${n} sin leer`),
    unreadTag: 'sin leer',
    empty: 'Aún no tienes notificaciones. Cuando alguien comente tus quizzes o te siga, aparecerá aquí.',
    error: 'No pudimos marcarlas como leídas. Inténtalo otra vez.',
    types: {
      comment: 'Comentario',
      follow: 'Seguidor',
      quiz_approved: 'Quiz',
      quiz_rejected: 'Quiz',
      achievement: 'Logro',
      mention: 'Mención',
    },
  },
  en: {
    markAll: 'Mark all as read',
    marking: 'Marking…',
    unread: (n: number) => (n === 1 ? '1 unread' : `${n} unread`),
    unreadTag: 'unread',
    empty: 'No notifications yet. When someone comments on your quizzes or follows you, it will show up here.',
    error: 'We could not mark them as read. Please try again.',
    types: {
      comment: 'Comment',
      follow: 'Follower',
      quiz_approved: 'Quiz',
      quiz_rejected: 'Quiz',
      achievement: 'Achievement',
      mention: 'Mention',
    },
  },
} as const;

export function NotificationList({
  notifications,
  unreadCount,
  locale,
}: {
  notifications: Notification[];
  unreadCount: number;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkAll() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await markAllNotificationsRead();
      if (result.success) {
        router.refresh();
      } else {
        setError(copy.error);
      }
    } catch {
      setError(copy.error);
    } finally {
      setPending(false);
    }
  }

  if (notifications.length === 0) {
    return <p className="text-text-muted mt-8 text-sm">{copy.empty}</p>;
  }

  return (
    <section className="mt-8" aria-label={locale === 'es' ? 'Notificaciones' : 'Notifications'}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-text-secondary text-sm" aria-live="polite">
          {unreadCount > 0 ? copy.unread(unreadCount) : null}
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={pending}
            className="border-border-subtle text-text-primary hover:border-accent-primary/40 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {pending ? copy.marking : copy.markAll}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-error mb-4 text-sm">
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`flex gap-3 rounded-[4px] border p-4 ${
              notification.is_read
                ? 'border-border-subtle bg-bg-secondary'
                : 'border-accent-primary/40 bg-bg-secondary'
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                notification.is_read ? 'bg-transparent' : 'bg-accent-primary'
              }`}
            />
            <div className="min-w-0">
              <p className="text-text-secondary flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="border-border-subtle text-text-muted rounded-full border px-2 py-0.5">
                  {copy.types[notification.type]}
                </span>
                {!notification.is_read ? (
                  <span className="sr-only">{copy.unreadTag}</span>
                ) : null}
                <time dateTime={notification.created_at} className="text-text-muted">
                  {formatRelativeDate(notification.created_at, locale)}
                </time>
              </p>
              <p
                className={`mt-1 text-sm leading-6 ${
                  notification.is_read
                    ? 'text-text-secondary'
                    : 'text-text-primary font-semibold'
                }`}
              >
                {notification.title}
              </p>
              {notification.body ? (
                <p className="text-text-secondary mt-0.5 text-sm leading-6">
                  {notification.body}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
