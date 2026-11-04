import Link from 'next/link';
import { localizeHref } from '@/lib/i18n/navigation';
import { getCategoryLabelBySlug } from '@/lib/i18n/catalog';
import { CookiePreferencesButton } from '@/components/shared/cookie-preferences-button';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function Footer({
  dictionary,
  locale,
  categorySlugs,
}: {
  dictionary: Dictionary;
  locale: Locale;
  /** Solo las categorías con quizzes publicados en este locale; una vacía 404ea. */
  categorySlugs: string[];
}) {
  return (
    <footer className="arcade-footer">
      <div className="arcade-wrap arcade-footer-inner">
        <div className="arcade-footer-brand">
          <Link href={localizeHref(locale, '/')} className="arcade-logo">
            QUIZ<span>VERSE</span>
          </Link>
          <p>{dictionary.footer.tagline}</p>
        </div>
        <div className="arcade-footer-groups">
          <nav aria-label={dictionary.footer.play}>
            <p className="arcade-footer-heading">{dictionary.footer.play}</p>
            <Link href={localizeHref(locale, '/quiz')}>{dictionary.common.explore}</Link>
            <Link href={localizeHref(locale, '/indice')}>{dictionary.footer.catalogIndex}</Link>
            <Link href={localizeHref(locale, '/novedades')}>{dictionary.footer.whatsNew}</Link>
            <Link href={localizeHref(locale, '/leaderboard')}>{dictionary.common.leaderboard}</Link>
            <Link href={localizeHref(locale, '/create')}>{dictionary.footer.createQuiz}</Link>
          </nav>
          <nav aria-label={dictionary.footer.brand}>
            <p className="arcade-footer-heading">{dictionary.footer.brand}</p>
            <Link href={localizeHref(locale, '/about')}>{dictionary.arcade.about}</Link>
            <Link href={localizeHref(locale, '/faq')}>{dictionary.footer.faq}</Link>
            <Link href={localizeHref(locale, '/widget')}>{dictionary.footer.embedQuiz}</Link>
            <Link href={localizeHref(locale, '/contact')}>{dictionary.arcade.contact}</Link>
          </nav>
        </div>
        {categorySlugs.length > 0 && (
          <nav className="arcade-footer-categories" aria-label={dictionary.footer.categories}>
            <p className="arcade-footer-heading">{dictionary.footer.categories}</p>
            <ul className="m-0 list-none p-0">
              {categorySlugs.map((slug) => (
                <li key={slug}>
                  <Link href={localizeHref(locale, `/category/${slug}`)}>
                    {getCategoryLabelBySlug(slug, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="arcade-footer-legal">
          <Link href={localizeHref(locale, '/privacy')}>{dictionary.arcade.privacy}</Link>
          <Link href={localizeHref(locale, '/terms')}>{dictionary.arcade.terms}</Link>
          <CookiePreferencesButton label={dictionary.footer.cookiePreferences} />
          <span>© {new Date().getFullYear()} QuizVerse</span>
        </div>
      </div>
    </footer>
  );
}
