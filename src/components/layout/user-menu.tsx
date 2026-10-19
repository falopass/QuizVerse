'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { signOutAction } from '@/actions/auth.actions';
import { useSupabase } from '@/providers/supabase-provider';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/dictionaries';

function displayName(user: User): string {
  const metadata = user.user_metadata as { name?: unknown; display_name?: unknown };
  for (const name of [metadata.name, metadata.display_name]) {
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return user.email?.split('@')[0] ?? '';
}

function useSignOut(locale: Locale) {
  const router = useRouter();
  const { user, signOut } = useSupabase();
  return async () => {
    await signOutAction();
    // La sesión del servidor ya murió; esto limpia la que el provider aún
    // tenga en memoria.
    if (user) await signOut();
    router.refresh();
    router.push(`/${locale}`);
  };
}

export function UserMenu({ locale }: { locale: Locale }) {
  const { user, loading } = useSupabase();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const onSignOut = useSignOut(locale);
  const isEs = locale === 'es';

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const itemClass =
    'text-text-primary hover:bg-bg-tertiary hover:text-accent-primary block w-full px-4 py-2.5 text-left text-sm';

  if (loading) {
    return (
      <span
        aria-hidden="true"
        className="border-border-subtle hidden h-11 w-20 rounded-full border opacity-40 lg:inline-flex"
      />
    );
  }

  if (!user) {
    return (
      <Link href={localizeHref(locale, '/login')} className="arcade-nav-link">
        {isEs ? 'Iniciar sesión' : 'Sign in'}
      </Link>
    );
  }

  const name = displayName(user) || (isEs ? 'Cuenta' : 'Account');

  return (
    <div ref={rootRef} className="relative hidden lg:flex">
      <button
        ref={triggerRef}
        type="button"
        className="arcade-nav-link gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          aria-hidden="true"
          className="bg-accent-primary text-bg-primary flex h-7 w-7 items-center justify-center rounded-full text-[11px]"
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-28 truncate">{name}</span>
      </button>
      {open && (
        <div
          id="user-menu-panel"
          role="menu"
          aria-label={isEs ? 'Menú de usuario' : 'User menu'}
          className="border-border-subtle bg-bg-secondary absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border py-1 shadow-xl"
        >
          <Link
            role="menuitem"
            href={localizeHref(locale, '/my-quizzes')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {isEs ? 'Mis quizzes' : 'My quizzes'}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/achievements')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {isEs ? 'Mis logros' : 'My achievements'}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/settings')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {isEs ? 'Ajustes' : 'Settings'}
          </Link>
          <button role="menuitem" type="button" className={itemClass} onClick={onSignOut}>
            {isEs ? 'Cerrar sesión' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

export function UserMenuMobile({ locale, onSelect }: { locale: Locale; onSelect?: () => void }) {
  const { user, loading } = useSupabase();
  const onSignOut = useSignOut(locale);
  const isEs = locale === 'es';

  if (loading) return null;

  if (!user) {
    return (
      <Link href={localizeHref(locale, '/login')} onClick={onSelect}>
        {isEs ? 'Iniciar sesión' : 'Sign in'}
      </Link>
    );
  }

  return (
    <>
      <Link href={localizeHref(locale, '/my-quizzes')} onClick={onSelect}>
        {isEs ? 'Mis quizzes' : 'My quizzes'}
      </Link>
      <Link href={localizeHref(locale, '/achievements')} onClick={onSelect}>
        {isEs ? 'Mis logros' : 'My achievements'}
      </Link>
      <Link href={localizeHref(locale, '/settings')} onClick={onSelect}>
        {isEs ? 'Ajustes' : 'Settings'}
      </Link>
      <button
        type="button"
        className="text-text-primary flex min-h-11 w-full items-center px-3 font-bold uppercase"
        onClick={async () => {
          onSelect?.();
          await onSignOut();
        }}
      >
        {isEs ? 'Cerrar sesión' : 'Sign out'}
      </button>
    </>
  );
}
