'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { signOutAction } from '@/actions/auth.actions';
import { useSupabase } from '@/providers/supabase-provider';
import { localizeHref } from '@/lib/i18n/navigation';
import { getCopy } from '@/lib/i18n/dictionaries';
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
  const copy = getCopy(locale, 'userMenu');

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
    'text-text-primary hover:bg-bg-tertiary hover:text-accent-primary flex min-h-11 w-full items-center px-4 text-left text-sm';

  if (loading) {
    return (
      <span
        aria-hidden="true"
        className="border-border-subtle hidden h-11 w-28 shrink-0 rounded-full border opacity-40 lg:inline-flex"
      />
    );
  }

  if (!user) {
    return (
      <Link href={localizeHref(locale, '/login')} className="arcade-nav-link w-28 shrink-0 justify-center">
        {copy.signIn}
      </Link>
    );
  }

  const name = displayName(user) || copy.account;

  return (
    <div ref={rootRef} className="relative hidden w-28 shrink-0 lg:flex">
      <button
        ref={triggerRef}
        type="button"
        className="arcade-nav-link w-full gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          aria-hidden="true"
          className="bg-accent-primary text-bg-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]"
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 truncate">{name}</span>
      </button>
      {open && (
        <div
          id="user-menu-panel"
          role="menu"
          aria-label={copy.label}
          className="border-border-subtle bg-bg-secondary absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border py-1 shadow-xl"
        >
          <Link
            role="menuitem"
            href={localizeHref(locale, '/me')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {copy.activity}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/profile')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {copy.profile}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/my-quizzes')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {copy.quizzes}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/create/ai')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {copy.createWithAi}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/achievements')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {copy.achievements}
          </Link>
          <Link
            role="menuitem"
            href={localizeHref(locale, '/settings')}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            {copy.settings}
          </Link>
          <button role="menuitem" type="button" className={itemClass} onClick={onSignOut}>
            {copy.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

export function UserMenuMobile({ locale, onSelect }: { locale: Locale; onSelect?: () => void }) {
  const { user, loading } = useSupabase();
  const onSignOut = useSignOut(locale);
  const copy = getCopy(locale, 'userMenu');
  const common = getCopy(locale, 'common');
  const nav = getCopy(locale, 'nav');

  if (loading) return null;

  if (!user) {
    return (
      <div className="arcade-mobile-menu-account">
        <Link
          href={localizeHref(locale, '/login')}
          className="arcade-mobile-menu-login"
          onClick={onSelect}
        >
          {common.login}
        </Link>
        <Link
          href={localizeHref(locale, '/register')}
          className="arcade-mobile-menu-register"
          onClick={onSelect}
        >
          {nav.createAccount}
        </Link>
      </div>
    );
  }

  const name = displayName(user) || copy.account;

  return (
    <div className="arcade-mobile-menu-account">
      <div className="arcade-mobile-menu-user">
        <span aria-hidden="true" className="arcade-mobile-menu-avatar">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="arcade-mobile-menu-name">{name}</span>
      </div>
      <div className="arcade-mobile-menu-links">
        <Link href={localizeHref(locale, '/me')} onClick={onSelect}>
          {copy.activity}
        </Link>
        <Link href={localizeHref(locale, '/profile')} onClick={onSelect}>
          {copy.profile}
        </Link>
        <Link href={localizeHref(locale, '/my-quizzes')} onClick={onSelect}>
          {copy.quizzes}
        </Link>
        <Link href={localizeHref(locale, '/create/ai')} onClick={onSelect}>
          {copy.createWithAi}
        </Link>
        <Link href={localizeHref(locale, '/achievements')} onClick={onSelect}>
          {copy.achievements}
        </Link>
        <Link href={localizeHref(locale, '/settings')} onClick={onSelect}>
          {copy.settings}
        </Link>
      </div>
      <button
        type="button"
        className="arcade-mobile-menu-signout"
        onClick={async () => {
          onSelect?.();
          await onSignOut();
        }}
      >
        {copy.signOut}
      </button>
    </div>
  );
}
