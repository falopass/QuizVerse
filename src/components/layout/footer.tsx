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
        <div>
          <Link href={localizeHref(locale, '/')} className="arcade-logo">
            QUIZ<span>VERSE</span>
          </Link>
          <p>{dictionary.footer.tagline}</p>
        </div>
        <nav aria-label={dictionary.arcade.footerNavigation}>
          <Link href={localizeHref(locale, '/quiz')}>{dictionary.common.explore}</Link>
          <Link href={localizeHref(locale, '/indice')}>
            {locale === 'es' ? 'Índice del catálogo' : 'Catalog index'}
          </Link>
          <Link href={localizeHref(locale, '/create')}>{dictionary.common.create}</Link>
          <Link href={localizeHref(locale, '/leaderboard')}>{dictionary.common.leaderboard}</Link>
          <Link href={localizeHref(locale, '/login')}>{dictionary.common.login}</Link>
          <Link href={localizeHref(locale, '/register')}>
            {locale === 'es' ? 'Crear cuenta' : 'Sign up'}
          </Link>
          <Link href={localizeHref(locale, '/notifications')}>
            {locale === 'es' ? 'Notificaciones' : 'Notifications'}
          </Link>
          <Link href={localizeHref(locale, '/about')}>{dictionary.arcade.about}</Link>
          <Link href={localizeHref(locale, '/privacy')}>{dictionary.arcade.privacy}</Link>
          <CookiePreferencesButton
            label={locale === 'es' ? 'Preferencias de cookies' : 'Cookie preferences'}
          />
          <Link href={localizeHref(locale, '/terms')}>{dictionary.arcade.terms}</Link>
          <Link href={localizeHref(locale, '/contact')}>{dictionary.arcade.contact}</Link>
          <Link href={localizeHref(locale, '/faq')}>
            {locale === 'es' ? 'Preguntas frecuentes' : 'FAQ'}
          </Link>
        </nav>
        {categorySlugs.length > 0 && (
          <nav aria-label={dictionary.explore.allCategories}>
            <p>{dictionary.explore.allCategories}</p>
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
      </div>
    </footer>
  );
}
