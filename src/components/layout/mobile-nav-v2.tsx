'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { localizeHref, stripLocaleFromPathname } from '@/lib/i18n/navigation';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function MobileNavV2({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  const pathname = usePathname();
  const normalizedPathname = stripLocaleFromPathname(pathname || '/');

  const items = [
    { href: localizeHref(locale, '/'), match: '/', label: locale === 'es' ? 'Inicio' : 'Home', icon: <HomeIcon /> },
    { href: localizeHref(locale, '/quiz'), match: '/quiz', label: dictionary.common.explore, icon: <ExploreIcon /> },
    { href: localizeHref(locale, '/create'), match: '/create', label: dictionary.common.create, icon: <CreateIcon /> },
    { href: localizeHref(locale, '/leaderboard'), match: '/leaderboard', label: dictionary.common.leaderboard, icon: <RanksIcon /> },
    { href: localizeHref(locale, '/login'), match: '/login', label: dictionary.common.login, icon: <ProfileIcon /> },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="mx-3 mb-3 rounded-[1.75rem] border border-border-subtle bg-bg-glass px-2 py-2 shadow-card backdrop-blur-xl">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const active =
              item.match === '/'
                ? normalizedPathname === '/'
                : normalizedPathname === item.match || normalizedPathname.startsWith(`${item.match}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-accent-primary' : 'text-text-muted'
                )}
              >
                <div className={cn('h-5 w-5', active && 'scale-110')}>{item.icon}</div>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8M5 10v10h14V10" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
    </svg>
  );
}

function RanksIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 20V10m6 10V4m6 16v-7"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM5 21a7 7 0 0114 0" />
    </svg>
  );
}
