'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { getLocalizedCategoryLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FloatingNav({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 18);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="fixed inset-x-0 top-0 z-40 px-4 pt-4">
      <div
        className={cn(
          'mx-auto flex w-full max-w-7xl items-center justify-between gap-4 transition-all duration-300',
          isScrolled
            ? 'border-border-subtle bg-bg-glass shadow-card rounded-full border px-4 py-3 backdrop-blur-xl'
            : 'rounded-[2rem] bg-transparent px-1 py-2'
        )}
      >
        <Link href={localizeHref(locale, '/')} className="group flex items-center gap-3">
          <div className="border-border-subtle bg-bg-secondary text-accent-primary flex h-11 w-11 items-center justify-center rounded-full border text-sm font-black tracking-[0.22em] uppercase">
            QV
          </div>
          <div className="hidden sm:block">
            <p className="font-display text-text-primary group-hover:text-accent-primary text-lg font-semibold transition-colors">
              QuizVerse
            </p>
            <p className="text-text-muted text-[11px] tracking-[0.22em] uppercase">
              {dictionary.nav.statement}
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <NavLink href={localizeHref(locale, '/quiz')}>{dictionary.common.explore}</NavLink>
          <NavLink href={localizeHref(locale, '/category/personality')}>
            {getLocalizedCategoryLabel('personality', locale)}
          </NavLink>
          <NavLink href={localizeHref(locale, '/category/trivia')}>
            {getLocalizedCategoryLabel('trivia', locale)}
          </NavLink>
          <NavLink href={localizeHref(locale, '/create')}>{dictionary.common.create}</NavLink>
          <NavLink href={localizeHref(locale, '/leaderboard')}>
            {dictionary.common.leaderboard}
          </NavLink>
        </div>

        <div className="flex items-center gap-2">
          <div className="border-border-subtle bg-bg-secondary text-text-muted hidden items-center gap-2 rounded-full border px-3 py-2 text-sm xl:flex">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>{dictionary.nav.search}</span>
            <kbd className="bg-bg-primary text-text-muted rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
              Ctrl K
            </kbd>
          </div>

          <ThemeToggle />
          <LocaleSwitcher value={locale} label={dictionary.common.switchLocale} />
          <Link
            href={localizeHref(locale, '/login')}
            className="text-text-secondary hover:text-text-primary hidden rounded-full px-4 py-2 text-sm font-medium transition-colors sm:inline-flex"
          >
            {dictionary.common.login}
          </Link>
          <Link
            href={localizeHref(locale, '/login')}
            className="bg-accent-primary hover:bg-accent-hover inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            {dictionary.common.signup}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-secondary hover:bg-bg-secondary hover:text-text-primary rounded-full px-4 py-2 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
