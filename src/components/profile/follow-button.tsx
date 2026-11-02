'use client';

/**
 * Botón «Seguir / Siguiendo» del perfil público.
 *
 * Sin sesión no se puede escribir en `user_follows`, así que se convierte en
 * un enlace a login que vuelve a este mismo perfil. Con sesión, un fallo de
 * la action no puede pasar en silencio (SOC-10): el estado del botón se
 * mantiene y se pinta el motivo — rate limit o error genérico.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toggleFollowAction } from '@/actions/social.actions';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';

const COPY = {
  es: {
    follow: 'Seguir',
    following: 'Siguiendo',
    rateLimited: 'Vas muy rápido. Espera un momento y vuelve a intentarlo.',
    error: 'No pudimos actualizar el seguimiento. Inténtalo otra vez.',
  },
  en: {
    follow: 'Follow',
    following: 'Following',
    rateLimited: 'You are going too fast. Wait a moment and try again.',
    error: 'We could not update the follow. Please try again.',
  },
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
  const [error, setError] = useState<'rate_limited' | 'generic' | null>(null);

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(pathname || '/');
    return (
      <Link
        href={localizeHref(locale, `/login?redirect=${redirect}`)}
        className={`${BASE_CLASSES} bg-accent-primary hover:bg-accent-hover text-bg-primary`}
      >
        {copy.follow}
      </Link>
    );
  }

  async function handleClick() {
    if (pending) return;
    const next = !following;
    setPending(true);
    setError(null);
    try {
      const result = await toggleFollowAction(targetUserId, next);
      if (result.ok) {
        setFollowing(next);
      } else {
        setError(result.code === 'rate_limited' ? 'rate_limited' : 'generic');
      }
    } catch {
      // La action puede rechazar por red: el estado queda igual y el botón se rehabilita.
      setError('generic');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={following}
        className={
          following
            ? `${BASE_CLASSES} border-border-subtle bg-bg-primary text-text-primary hover:border-accent-primary/40 border`
            : `${BASE_CLASSES} bg-accent-primary hover:bg-accent-hover text-bg-primary`
        }
      >
        {following ? copy.following : copy.follow}
      </button>
      {error ? (
        <p role="alert" className="text-error max-w-xs text-sm">
          {error === 'rate_limited' ? copy.rateLimited : copy.error}
        </p>
      ) : null}
    </div>
  );
}
