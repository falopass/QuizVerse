'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';
import { LocaleSwitcher } from './locale-switcher';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FloatingNav({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
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
        'fixed top-0 left-0 right-0 z-40',
        'flex items-center justify-between',
        'px-4 py-3 mx-auto max-w-7xl',
        'transition-all duration-300',
        isScrolled
          ? 'mt-2 rounded-full border border-border-subtle bg-bg-glass shadow-card backdrop-blur-xl'
          : 'bg-transparent mt-4'
      )}
    >
      <Link href="/" className="flex items-center gap-2 group">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-bg-secondary text-sm font-black uppercase tracking-[0.2em] text-accent-primary">
          QV
        </div>
        <div className="hidden sm:block">
          <span className="font-display text-lg font-semibold text-text-primary transition-colors group-hover:text-accent-primary">
            QuizVerse
          </span>
          <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
            {dictionary.nav.statement}
          </p>
        </div>
        <span className="font-display text-lg font-semibold text-text-primary transition-colors group-hover:text-accent-primary sm:hidden">
          QuizVerse
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-1">
        <NavLink href="/quiz">{dictionary.common.explore}</NavLink>
        <NavLink href="/category/personality">Personality</NavLink>
        <NavLink href="/leaderboard">{dictionary.common.leaderboard}</NavLink>
        <NavLink href="/create">{dictionary.common.create}</NavLink>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={cn(
            'hidden lg:flex items-center gap-2',
            'rounded-full border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-muted',
            'hover:border-accent-primary/40 hover:text-text-primary',
            'transition-all duration-200'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>{dictionary.nav.search}</span>
          <kbd className="hidden lg:inline-flex px-1.5 py-0.5 text-xs bg-bg-tertiary rounded">
            ⌘K
          </kbd>
        </button>

        <LocaleSwitcher value={locale} label={dictionary.common.switchLocale} />
        <Link
          href="/login"
          className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          {dictionary.common.login}
        </Link>
        <Link
          href="/login"
          className="inline-flex rounded-full bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
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
        'px-3 py-2 text-sm font-medium rounded-lg',
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
