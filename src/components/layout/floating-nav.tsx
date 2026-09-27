import Link from 'next/link';
import { getLocalizedCategoryLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FloatingNav({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  return (
    <header className="arcade-header">
      <div className="arcade-wrap arcade-header-inner">
        <Link href={localizeHref(locale, '/')} className="arcade-logo" aria-label="QuizVerse">
          QUIZ<span>VERSE</span>
        </Link>
        <nav className="arcade-nav" aria-label={dictionary.arcade.mainNavigation}>
          <Link href={localizeHref(locale, '/quiz')} className="arcade-nav-link">{dictionary.common.explore}</Link>
          <Link href={localizeHref(locale, '/category/personality')} className="arcade-nav-link">{getLocalizedCategoryLabel('personality', locale)}</Link>
          <Link href={localizeHref(locale, '/category/trivia')} className="arcade-nav-link">{getLocalizedCategoryLabel('trivia', locale)}</Link>
          <LocaleSwitcher value={locale} label={dictionary.common.switchLocale} />
          <Link href={localizeHref(locale, '/quiz')} className="arcade-pill">{dictionary.arcade.pickGame} ↗</Link>
        </nav>
      </div>
    </header>
  );
}
