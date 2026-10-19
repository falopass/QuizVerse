'use client';

/**
 * Botón «Seguir / Siguiendo» del perfil público.
 *
 * Sin sesión no se puede escribir en `user_follows`, así que se convierte en
 * un enlace a login que vuelve a este mismo perfil.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toggleFollowAction } from '@/actions/social.actions';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: { follow: 'Seguir', following: 'Siguiendo' },
  en: { follow: 'Follow', following: 'Following' },
} as const;

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60';

export function FollowButton({
  targetUserId,
  initialFollowing,
  isAuthenticated,
  locale,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const pathname = usePathname();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(pathname || '/');
    return (
      <Link
        href={localizeHref(locale, `/login?redirect=${redirect}`)}
        className={`${BASE_CLASSES} bg-accent-primary hover:bg-accent-hover text-white`}
      >
        {copy.follow}
      </Link>
    );
  }

  async function handleClick() {
    if (pending) return;
    const next = !following;
    setPending(true);
    try {
      const result = await toggleFollowAction(targetUserId, next);
      if (result.ok) setFollowing(next);
    } catch {
      // La action puede rechazar por red: el estado queda igual y el botón se rehabilita.
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={following}
      className={
        following
          ? `${BASE_CLASSES} border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 border`
          : `${BASE_CLASSES} bg-accent-primary hover:bg-accent-hover text-white`
      }
    >
      {following ? copy.following : copy.follow}
    </button>
  );
}
