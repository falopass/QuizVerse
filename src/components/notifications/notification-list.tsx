'use client';

/**
 * Lista de notificaciones propias.
 *
 * El servidor entrega las últimas 50 con su destino ya resuelto (`href`,
 * `actorName`, `quizTitle`) y el conteo real de no leídas. Cada tarjeta con
 * `href` es un enlace — navegable con teclado — que se marca leída al abrirse;
 * «marcar todas» va a `markAllNotificationsRead`. El badge del header se
 * actualiza por el store compartido cuando la action confirma.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead, markNotificationRead } from '@/actions/notifications.actions';
import { useNotificationBadge } from '@/stores/notification-store';
import { getCopy } from '@/lib/i18n/dictionaries';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { formatRelativeDate } from '@/lib/utils/format';
import type { ResolvedNotification } from '@/lib/notifications/resolve';

type NotificationsCopy = Dictionary['notifications'];

/** Tipos conocidos: título localizado; desconocidos: el texto guardado. */
function notificationTitle(notification: ResolvedNotification, copy: NotificationsCopy): string {
  return copy.titles[notification.type] ?? notification.title;
}

function notificationBody(
  notification: ResolvedNotification,
  copy: NotificationsCopy
): string | null {
  switch (notification.type) {
    case 'comment':
      return copy.commentBody(notification.actorName, notification.quizTitle);
    case 'follow':
      return copy.followBody(notification.actorName);
    case 'quiz_approved':
      return copy.quizApprovedBody(notification.quizTitle);
    case 'quiz_rejected':
      return copy.quizRejectedBody(notification.quizTitle);
    default:
      // Tipos nuevos o sin plantilla: se pinta el cuerpo guardado tal cual.
      return notification.body;
  }
}

const cardClass = (isRead: boolean) =>
  `flex gap-3 rounded-[4px] border p-4 ${
    isRead ? 'border-border-subtle bg-bg-secondary' : 'border-accent-primary/40 bg-bg-secondary'
  }`;

export function NotificationList({
  notifications,
  unreadCount,
  locale,
}: {
  notifications: ResolvedNotification[];
  unreadCount: number;
  locale: Locale;
}) {
  const copy = getCopy(locale, 'notifications');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decrementUnread = useNotificationBadge((state) => state.decrementUnread);
  const setUnread = useNotificationBadge((state) => state.setUnread);

  async function handleMarkAll() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await markAllNotificationsRead();
      if (result.success) {
        setUnread(0);
        router.refresh();
      } else {
        setError(copy.markError);
      }
    } catch {
      setError(copy.markError);
    } finally {
      setPending(false);
    }
  }

  function handleOpen(notification: ResolvedNotification) {
    if (notification.is_read) return;
    // El badge solo baja cuando la action confirma: si el UPDATE falla, el
    // servidor sigue contando esa notificación como no leída.
    void markNotificationRead(notification.id)
      .then((result) => {
        if (result.success) decrementUnread();
        router.refresh();
      })
      .catch(() => {});
  }

  if (notifications.length === 0) {
    return <p className="text-text-muted mt-8 text-sm">{copy.empty}</p>;
  }

  return (
    <section className="mt-8" aria-label={copy.title}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-text-secondary text-sm" aria-live="polite">
          {unreadCount > 0 ? copy.unread(unreadCount) : null}
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={pending}
            className="border-border-subtle text-text-primary hover:border-accent-primary/40 min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
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
        {notifications.map((notification) => {
          const title = notificationTitle(notification, copy);
          const body = notificationBody(notification, copy);
          const content = (
            <>
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  notification.is_read ? 'bg-transparent' : 'bg-accent-primary'
                }`}
              />
              <div className="min-w-0">
                <p className="text-text-secondary flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="border-border-subtle text-text-muted rounded-full border px-2 py-0.5">
                    {copy.typeLabels[notification.type] ?? copy.typeLabels.generic}
                  </span>
                  {!notification.is_read ? <span className="sr-only">{copy.unreadTag}</span> : null}
                  <time dateTime={notification.created_at} className="text-text-muted">
                    {formatRelativeDate(notification.created_at, locale)}
                  </time>
                </p>
                <p
                  className={`mt-1 text-sm leading-6 ${
                    notification.is_read ? 'text-text-secondary' : 'text-text-primary font-semibold'
                  }`}
                >
                  {title}
                </p>
                {body ? (
                  <p className="text-text-secondary mt-0.5 text-sm leading-6">{body}</p>
                ) : null}
              </div>
            </>
          );
          return (
            <li key={notification.id}>
              {notification.href ? (
                <Link
                  href={notification.href}
                  onClick={() => handleOpen(notification)}
                  className={`${cardClass(notification.is_read)} hover:border-accent-primary/60 transition-colors`}
                >
                  {content}
                </Link>
              ) : (
                <div className={cardClass(notification.is_read)}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
