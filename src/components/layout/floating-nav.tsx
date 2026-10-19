'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLocalizedCategoryLabel } from '@/lib/i18n/catalog';
import { localizeHref, stripLocaleFromPathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { LocaleSwitcher } from './locale-switcher';
import { UserMenu, UserMenuMobile } from './user-menu';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FloatingNav({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const normalizedPathname = stripLocaleFromPathname(pathname || '/');
  const isActive = (match: string) =>
    normalizedPathname === match || normalizedPathname.startsWith(`${match}/`);
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
        <button
          type="button"
          className="arcade-menu-button"
          aria-expanded={open}
          aria-controls="arcade-mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {locale === 'es' ? 'Menú' : 'Menu'} ☰
        </button>
      </div>
      {open && (
        <nav
          id="arcade-mobile-menu"
          className="arcade-mobile-menu"
          aria-label={dictionary.arcade.mainNavigation}
        >
          <Link
            href={localizeHref(locale, '/quiz')}
            className={cn(isActive('/quiz') && 'text-accent-primary')}
            aria-current={isActive('/quiz') ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {dictionary.common.explore}
          </Link>
          <Link
            href={localizeHref(locale, '/category/personality')}
            className={cn(isActive('/category/personality') && 'text-accent-primary')}
            aria-current={isActive('/category/personality') ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {getLocalizedCategoryLabel('personality', locale)}
          </Link>
          <Link
            href={localizeHref(locale, '/category/trivia')}
            className={cn(isActive('/category/trivia') && 'text-accent-primary')}
            aria-current={isActive('/category/trivia') ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {getLocalizedCategoryLabel('trivia', locale)}
          </Link>
          <Link
            href={localizeHref(locale, '/random')}
            prefetch={false}
            className={cn(isActive('/random') && 'text-accent-primary')}
            aria-current={isActive('/random') ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {dictionary.common.randomQuiz}
          </Link>
          <UserMenuMobile locale={locale} onSelect={() => setOpen(false)} />
        </nav>
      )}
    </header>
  );
}
