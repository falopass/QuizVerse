'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';
import { LocaleSwitcher } from './locale-switcher';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FloatingNav({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 right-0 left-0 z-40',
        'flex items-center justify-between',
        'mx-auto max-w-7xl px-4 py-3',
        'transition-all duration-300',
        isScrolled
          ? 'border-border-subtle bg-bg-glass shadow-card mt-2 rounded-full border backdrop-blur-xl'
          : 'mt-4 bg-transparent'
      )}
    >
      <Link href="/" className="group flex items-center gap-2">
        <div className="border-border-subtle bg-bg-secondary text-accent-primary flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black tracking-[0.2em] uppercase">
          QV
        </div>
        <div className="hidden sm:block">
          <span className="font-display text-text-primary group-hover:text-accent-primary text-lg font-semibold transition-colors">
            QuizVerse
          </span>
          <p className="text-text-muted text-[11px] tracking-[0.2em] uppercase">
            {dictionary.nav.statement}
          </p>
        </div>
        <span className="font-display text-text-primary group-hover:text-accent-primary text-lg font-semibold transition-colors sm:hidden">
          QuizVerse
        </span>
      </Link>

      <div className="hidden items-center gap-1 md:flex">
        <NavLink href="/quiz">{dictionary.common.explore}</NavLink>
        <NavLink href="/category/personality">Personality</NavLink>
        <NavLink href="/leaderboard">{dictionary.common.leaderboard}</NavLink>
        <NavLink href="/create">{dictionary.common.create}</NavLink>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={cn(
            'hidden items-center gap-2 lg:flex',
            'border-border-subtle bg-bg-secondary text-text-muted rounded-full border px-3 py-2 text-sm',
            'hover:border-accent-primary/40 hover:text-text-primary',
            'transition-all duration-200'
          )}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>{dictionary.nav.search}</span>
          <kbd className="bg-bg-tertiary hidden rounded px-1.5 py-0.5 text-xs lg:inline-flex">
            ⌘K
          </kbd>
        </button>

        <LocaleSwitcher value={locale} label={dictionary.common.switchLocale} />
        <Link
          href="/login"
          className="text-text-secondary hover:text-text-primary hidden px-4 py-2 text-sm font-medium transition-colors sm:inline-flex"
        >
          {dictionary.common.login}
        </Link>
        <Link
          href="/login"
          className="bg-accent-primary hover:bg-accent-hover inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          {dictionary.common.signup}
        </Link>
      </div>
    </nav>
  );
}

// ============================================
// NAVLINK COMPONENT
// ============================================

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}

function NavLink({ href, children, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium',
        'transition-colors duration-200',
        active
          ? 'text-accent-primary bg-accent-primary/10'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
      )}
    >
      {children}
    </Link>
  );
}
