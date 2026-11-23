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
import { formatMessage } from '@/lib/i18n/format';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { formatRelativeDate } from '@/lib/utils/format';
import type { ResolvedNotification } from '@/lib/notifications/resolve';

type NotificationsCopy = Pick<
  Dictionary['notifications'],
  | 'title'
  | 'markAll'
  | 'marking'
  | 'unread'
  | 'unreadTag'
  | 'empty'
  | 'markError'
  | 'someone'
  | 'yourQuiz'
  | 'typeLabels'
  | 'titles'
  | 'commentBody'
  | 'followBody'
  | 'quizApprovedBody'
  | 'quizApprovedBodyGeneric'
  | 'quizRejectedBody'
  | 'quizRejectedBodyGeneric'
>;

const COPY: Record<Locale, NotificationsCopy> = {
  en: {
    title: 'Notifications',
    markAll: 'Mark all as read',
    marking: 'Marking…',
    unread: '{count} unread',
    unreadTag: 'unread',
    empty:
      'No notifications yet. When someone comments on your quizzes or follows you, it will show up here.',
    markError: 'We could not mark them as read. Please try again.',
    someone: 'Someone',
    yourQuiz: 'your quiz',
    typeLabels: {
      comment: 'Comment',
      follow: 'Follower',
      quiz_approved: 'Quiz',
      quiz_rejected: 'Quiz',
      achievement: 'Achievement',
      mention: 'Mention',
      generic: 'Update',
    },
    titles: {
      comment: 'New comment on your quiz',
      follow: 'New follower',
      quiz_approved: 'Quiz approved',
      quiz_rejected: 'Quiz rejected',
      achievement: 'Achievement unlocked',
      mention: 'New mention',
    },
    commentBody: '{name} commented on {quiz}',
    followBody: '{name} started following you',
    quizApprovedBody: '"{quiz}" was approved and is now live.',
    quizApprovedBodyGeneric: 'Your quiz was approved and is now live.',
    quizRejectedBody: '"{quiz}" was rejected. Review it in My quizzes.',
    quizRejectedBodyGeneric: 'Your quiz was rejected. Review it in My quizzes.',
  },
  es: {
    title: 'Notificaciones',
    markAll: 'Marcar todas como leídas',
    marking: 'Marcando…',
    unread: '{count} sin leer',
    unreadTag: 'sin leer',
    empty:
      'Aún no tienes notificaciones. Cuando alguien comente tus quizzes o te siga, aparecerá aquí.',
    markError: 'No pudimos marcarlas como leídas. Inténtalo otra vez.',
    someone: 'Alguien',
    yourQuiz: 'tu quiz',
    typeLabels: {
      comment: 'Comentario',
      follow: 'Seguidor',
      quiz_approved: 'Quiz',
      quiz_rejected: 'Quiz',
      achievement: 'Logro',
      mention: 'Mención',
      generic: 'Aviso',
    },
    titles: {
      comment: 'Nuevo comentario en tu quiz',
      follow: 'Nuevo seguidor',
      quiz_approved: 'Quiz aprobado',
      quiz_rejected: 'Quiz rechazado',
      achievement: 'Logro desbloqueado',
      mention: 'Te mencionaron',
    },
    commentBody: '{name} comentó en {quiz}',
    followBody: '{name} empezó a seguirte',
    quizApprovedBody: '"{quiz}" fue aprobado y ya está publicado.',
    quizApprovedBodyGeneric: 'Tu quiz fue aprobado y ya está publicado.',
    quizRejectedBody: '"{quiz}" fue rechazado. Revísalo en Mis quizzes.',
    quizRejectedBodyGeneric: 'Tu quiz fue rechazado. Revísalo en Mis quizzes.',
  },
};

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
      // Referencia borrada (perfil o quiz que ya no resuelve): el cuerpo
      // guardado conserva el nombre y el título reales; la plantilla solo
      // los recibiría genéricos.
      if (notification.actorName && notification.quizTitle) {
        return formatMessage(copy.commentBody, {
          name: notification.actorName,
          quiz: `"${notification.quizTitle}"`,
        });
      }
      return (
        notification.body ??
        formatMessage(copy.commentBody, {
          name: notification.actorName ?? copy.someone,
          quiz: notification.quizTitle ? `"${notification.quizTitle}"` : copy.yourQuiz,
        })
      );
    case 'follow':
      if (notification.actorName) {
        return formatMessage(copy.followBody, { name: notification.actorName });
      }
      return notification.body ?? formatMessage(copy.followBody, { name: copy.someone });
    case 'quiz_approved':
    case 'quiz_rejected': {
      // El trigger escribe el cuerpo ya localizado y, en el rechazo, con el
      // motivo: si existe manda él; la plantilla cubre filas sin cuerpo.
      if (notification.body) return notification.body;
      const [template, generic] =
        notification.type === 'quiz_approved'
          ? [copy.quizApprovedBody, copy.quizApprovedBodyGeneric]
          : [copy.quizRejectedBody, copy.quizRejectedBodyGeneric];
      return notification.quizTitle
        ? formatMessage(template, { quiz: notification.quizTitle })
        : generic;
    }
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
  const copy = COPY[locale];
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
        <p className="text-text-secondary text-sm tabular-nums" aria-live="polite">
          {unreadCount > 0 ? formatMessage(copy.unread, { count: unreadCount }) : null}
        </p>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={pending}
            className="border-border-subtle text-text-primary hover:border-accent-primary min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
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
