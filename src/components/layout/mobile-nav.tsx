'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function MobileNav({ dictionary }: { dictionary: Dictionary }) {
  const pathname = usePathname();

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-40 md:hidden">
      <div className="bg-bg-glass border-border-subtle absolute inset-0 border-t backdrop-blur-xl" />

      <div className="safe-area-bottom relative flex items-center justify-around py-2">
        <MobileNavItem href="/" label="Home" icon={<HomeIcon />} active={pathname === '/'} />
        <MobileNavItem
          href="/quiz"
          label={dictionary.common.explore}
          icon={<ExploreIcon />}
          active={pathname === '/quiz'}
        />
        <MobileNavItem
          href="/create"
          label={dictionary.common.create}
          icon={<CreateIcon />}
          active={pathname === '/create' || pathname === '/create/ai'}
        />
        <MobileNavItem
          href="/leaderboard"
          label="Ranks"
          icon={<RanksIcon />}
          active={pathname === '/leaderboard'}
        />
        <MobileNavItem
          href="/login"
          label="Profile"
          icon={<ProfileIcon />}
          active={pathname === '/login' || (pathname?.startsWith('/profile') ?? false)}
        />
      </div>
    </nav>
  );
}

// ============================================
// MOBILE NAV ITEM
// ============================================

interface MobileNavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

function MobileNavItem({ href, label, icon, active }: MobileNavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 px-3 py-1',
        'transition-colors duration-200',
        active ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary'
      )}
    >
      <div className={cn('h-6 w-6', 'transition-transform duration-200', active && 'scale-110')}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

// ============================================
// ICONS
// ============================================

function HomeIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function RanksIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}
