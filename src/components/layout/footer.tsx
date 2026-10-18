import Link from 'next/link';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function Footer({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  return (
    <footer className="arcade-footer">
      <div className="arcade-wrap arcade-footer-inner">
        <div>
          <Link href={localizeHref(locale, '/')} className="arcade-logo">
            QUIZ<span>VERSE</span>
          </Link>
          <p>{dictionary.footer.tagline}</p>
        </div>
        <nav aria-label={dictionary.arcade.footerNavigation}>
          <Link href={localizeHref(locale, '/quiz')}>{dictionary.common.explore}</Link>
          <Link href={localizeHref(locale, '/create')}>{dictionary.common.create}</Link>
          <Link href={localizeHref(locale, '/leaderboard')}>{dictionary.common.leaderboard}</Link>
          <Link href={localizeHref(locale, '/login')}>{dictionary.common.login}</Link>
          <Link href={localizeHref(locale, '/about')}>{dictionary.arcade.about}</Link>
          <Link href={localizeHref(locale, '/privacy')}>{dictionary.arcade.privacy}</Link>
          <Link href={localizeHref(locale, '/terms')}>{dictionary.arcade.terms}</Link>
          <Link href={localizeHref(locale, '/contact')}>{dictionary.arcade.contact}</Link>
        </nav>
      </div>
    </footer>
  );
}
