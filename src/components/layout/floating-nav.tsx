'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localizeHref, stripLocaleFromPathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { LocaleSwitcher } from './locale-switcher';
import { NotificationBell } from './notification-bell';
import { UserMenu, UserMenuMobile } from './user-menu';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export interface NavLabels {
  mainNavigation: string;
  explore: string;
  dailyQuiz: string;
  leaderboard: string;
  personality: string;
  trivia: string;
  randomQuiz: string;
  mobileRandomQuiz: string;
  switchLocale: string;
  pickGame: string;
  menu: string;
}

export function extractNavLabels(dictionary: Dictionary, _locale: Locale): NavLabels {
  return {
    mainNavigation: dictionary.arcade.mainNavigation,
    explore: dictionary.common.explore,
    dailyQuiz: dictionary.common.dailyQuiz,
    leaderboard: dictionary.common.leaderboard,
    personality: dictionary.nav.personality,
    trivia: dictionary.nav.trivia,
    randomQuiz: dictionary.common.randomQuiz,
    mobileRandomQuiz: dictionary.nav.randomQuiz,
    switchLocale: dictionary.common.switchLocale,
    pickGame: dictionary.arcade.pickGame,
    menu: dictionary.nav.menu,
  };
}

type FloatingNavProps =
  | { locale: Locale; navLabels: NavLabels; dictionary?: never }
  | { locale: Locale; dictionary: Dictionary; navLabels?: never };

export function FloatingNav(props: FloatingNavProps) {
  const { locale } = props;
  const labels = props.navLabels ?? extractNavLabels(props.dictionary, locale);
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
    { href: '/quiz', match: '/quiz', label: labels.explore },
    { href: '/daily', match: '/daily', label: labels.dailyQuiz },
    {
      href: '/category/personality',
      match: '/category/personality',
      label: labels.personality,
    },
    {
      href: '/category/trivia',
      match: '/category/trivia',
      label: labels.trivia,
    },
    { href: '/leaderboard', match: '/leaderboard', label: labels.leaderboard },
  ];

  return (
    <header className="arcade-header">
      <div className="arcade-wrap arcade-header-inner">
        <Link href={localizeHref(locale, '/')} className="arcade-logo" aria-label="QuizVerse">
          QUIZ<span>VERSE</span>
        </Link>
        <nav className="arcade-nav" aria-label={labels.mainNavigation}>
          <Link
            href={localizeHref(locale, '/quiz')}
            className={cn('arcade-nav-link', isActive('/quiz') && 'text-accent-primary')}
            aria-current={isActive('/quiz') ? 'page' : undefined}
          >
            {labels.explore}
          </Link>
          <Link
            href={localizeHref(locale, '/daily')}
            className={cn('arcade-nav-link', isActive('/daily') && 'text-accent-primary')}
            aria-current={isActive('/daily') ? 'page' : undefined}
          >
            {labels.dailyQuiz}
          </Link>
          <Link
            href={localizeHref(locale, '/category/personality')}
            className={cn(
              'arcade-nav-link',
              isActive('/category/personality') && 'text-accent-primary'
            )}
            aria-current={isActive('/category/personality') ? 'page' : undefined}
          >
            {labels.personality}
          </Link>
          <Link
            href={localizeHref(locale, '/category/trivia')}
            className={cn('arcade-nav-link', isActive('/category/trivia') && 'text-accent-primary')}
            aria-current={isActive('/category/trivia') ? 'page' : undefined}
          >
            {labels.trivia}
          </Link>
          <Link
            href={localizeHref(locale, '/leaderboard')}
            className={cn('arcade-nav-link', isActive('/leaderboard') && 'text-accent-primary')}
            aria-current={isActive('/leaderboard') ? 'page' : undefined}
          >
            {labels.leaderboard}
          </Link>
          <LocaleSwitcher value={locale} label={labels.switchLocale} />
          {/* Una sola acción de juego en la barra: el azar entra directo a la
              primera pregunta. Explorar ya tiene su enlace, así que la píldora
              no repite /quiz. /random es un route handler 307, no una página
              RSC: sin prefetch el redirect resuelve al hacer clic. */}
          <Link href={localizeHref(locale, '/random')} prefetch={false} className="arcade-pill">
            {labels.randomQuiz} <span aria-hidden="true">↗</span>
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
            aria-label={labels.menu}
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
          aria-label={labels.mainNavigation}
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
              {labels.mobileRandomQuiz}
            </Link>
          </div>
          <UserMenuMobile locale={locale} onSelect={() => setOpen(false)} />
          <div className="arcade-mobile-menu-locale">
            <LocaleSwitcher value={locale} label={labels.switchLocale} />
          </div>
        </nav>
      )}
    </header>
  );
}
