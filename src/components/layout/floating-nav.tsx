'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocalizedCategoryLabel } from '@/lib/i18n/catalog';
import { localizeHref, stripLocaleFromPathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { LocaleSwitcher } from './locale-switcher';
import { NotificationBell } from './notification-bell';
import { UserMenu, UserMenuMobile } from './user-menu';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FloatingNav({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const normalizedPathname = stripLocaleFromPathname(pathname || '/');
  const isActive = (match: string) =>
    normalizedPathname === match || normalizedPathname.startsWith(`${match}/`);

  // Cierra el menú al navegar (mismo patrón que UserMenu).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const mobileItems = [
    { href: '/quiz', match: '/quiz', label: dictionary.common.explore },
    { href: '/daily', match: '/daily', label: dictionary.common.dailyQuiz },
    {
      href: '/category/personality',
      match: '/category/personality',
      label: getLocalizedCategoryLabel('personality', locale),
    },
    {
      href: '/category/trivia',
      match: '/category/trivia',
      label: getLocalizedCategoryLabel('trivia', locale),
    },
    { href: '/leaderboard', match: '/leaderboard', label: dictionary.common.leaderboard },
  ];

  return (
    <header className="arcade-header">
      <div className="arcade-wrap arcade-header-inner">
        <Link href={localizeHref(locale, '/')} className="arcade-logo" aria-label="QuizVerse">
          QUIZ<span>VERSE</span>
        </Link>
        <nav className="arcade-nav" aria-label={dictionary.arcade.mainNavigation}>
          <Link
            href={localizeHref(locale, '/quiz')}
            className={cn('arcade-nav-link', isActive('/quiz') && 'text-accent-primary')}
            aria-current={isActive('/quiz') ? 'page' : undefined}
          >
            {dictionary.common.explore}
          </Link>
          <Link
            href={localizeHref(locale, '/daily')}
            className={cn('arcade-nav-link', isActive('/daily') && 'text-accent-primary')}
            aria-current={isActive('/daily') ? 'page' : undefined}
          >
            {dictionary.common.dailyQuiz}
          </Link>
          <Link
            href={localizeHref(locale, '/leaderboard')}
            className={cn('arcade-nav-link', isActive('/leaderboard') && 'text-accent-primary')}
            aria-current={isActive('/leaderboard') ? 'page' : undefined}
          >
            {dictionary.common.leaderboard}
          </Link>
          <Link
            href={localizeHref(locale, '/category/personality')}
            className={cn(
              'arcade-nav-link',
              isActive('/category/personality') && 'text-accent-primary'
            )}
            aria-current={isActive('/category/personality') ? 'page' : undefined}
          >
            {getLocalizedCategoryLabel('personality', locale)}
          </Link>
          <Link
            href={localizeHref(locale, '/category/trivia')}
            className={cn('arcade-nav-link', isActive('/category/trivia') && 'text-accent-primary')}
            aria-current={isActive('/category/trivia') ? 'page' : undefined}
          >
            {getLocalizedCategoryLabel('trivia', locale)}
          </Link>
          {/* /random is a 307 route handler, not an RSC page: no prefetch so the
              redirect resolves to the real quiz URL on click. */}
          <Link
            href={localizeHref(locale, '/random')}
            prefetch={false}
            className={cn('arcade-nav-link', isActive('/random') && 'text-accent-primary')}
            aria-current={isActive('/random') ? 'page' : undefined}
          >
            {dictionary.common.randomQuiz}
          </Link>
          <LocaleSwitcher value={locale} label={dictionary.common.switchLocale} />
          <Link href={localizeHref(locale, '/quiz')} className="arcade-pill">
            {dictionary.arcade.pickGame} ↗
          </Link>
          <UserMenu locale={locale} />
        </nav>
        {/* Fuera de `.arcade-nav`: la navegación de escritorio se oculta bajo
            1024px y la campana debe verse también en móvil. */}
        <div className="arcade-header-actions">
          <NotificationBell locale={locale} />
          <button
            ref={menuButtonRef}
            type="button"
            className="arcade-menu-button"
            aria-label={dictionary.nav.menu}
            aria-expanded={open}
            aria-controls="arcade-mobile-menu"
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="arcade-mobile-menu"
          className="arcade-mobile-menu"
          aria-label={dictionary.arcade.mainNavigation}
        >
          <div className="arcade-mobile-menu-nav">
            {mobileItems.map((item) => (
              <Link
                key={item.href}
                href={localizeHref(locale, item.href)}
                className={cn(isActive(item.match) && 'text-accent-primary')}
                aria-current={isActive(item.match) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {/* /random es un route handler 307, no una página RSC: sin prefetch
                el redirect resuelve a la URL real del quiz al hacer clic. */}
            <Link
              href={localizeHref(locale, '/random')}
              prefetch={false}
              className={cn(isActive('/random') && 'text-accent-primary')}
              aria-current={isActive('/random') ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {dictionary.nav.randomQuiz}
            </Link>
          </div>
          <UserMenuMobile locale={locale} onSelect={() => setOpen(false)} />
          <div className="arcade-mobile-menu-locale">
            <LocaleSwitcher value={locale} label={dictionary.common.switchLocale} />
          </div>
        </nav>
      )}
    </header>
  );
}
