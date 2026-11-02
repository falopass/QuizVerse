'use client';

/**
 * Campana del header con el conteo de notificaciones sin leer.
 *
 * Una consulta `count` por montaje, re-hecha al navegar y cada 60 s solo si la
 * pestaña está visible. `NotificationList` decrementa el store compartido al
 * abrir una notificación, así que el badge reacciona sin esperar al refetch.
 * Sin sesión no se renderiza: `/notifications` exige login.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { useNotificationBadge } from '@/stores/notification-store';
import { getCopy } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';

const REFRESH_MS = 60_000;

export function NotificationBell({ locale }: { locale: Locale }) {
  const { supabase, user, loading } = useSupabase();
  const pathname = usePathname();
  const unread = useNotificationBadge((state) => state.unread);
  const setUnread = useNotificationBadge((state) => state.setUnread);
  const copy = getCopy(locale, 'notifications');

  useEffect(() => {
    if (!user) {
      setUnread(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (!cancelled && !error) setUnread(count ?? 0);
    };
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, pathname, supabase, setUnread]);

  if (loading || !user) return null;

  return (
    <Link
      href={localizeHref(locale, '/notifications')}
      className="text-text-primary hover:text-accent-primary relative inline-flex min-h-11 items-center px-2 transition-colors"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread !== null && unread > 0 ? (
        <span
          aria-hidden="true"
          className="bg-accent-primary text-bg-primary absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
      <span className="sr-only">
        {unread !== null && unread > 0 ? copy.bellUnread(unread) : copy.bell}
      </span>
    </Link>
  );
}
