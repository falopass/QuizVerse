import Link from 'next/link';
import { getLocalizedCategoryLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function FooterV2({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  const currentYear = new Date().getFullYear();
  const copy =
    locale === 'es'
      ? {
          explore: 'Explorar',
          allQuizzes: 'Todos los quizzes',
          studio: 'Estudio',
          manualCreator: 'Creador manual',
          aiGenerator: 'Generador AI',
          account: 'Cuenta',
          info: 'Info',
          leaderboard: 'Ranking',
          about: 'Acerca de',
          privacy: 'Privacidad',
          terms: 'Términos',
          contact: 'Contacto',
          rights: `Copyright ${currentYear} QuizVerse. Todos los derechos reservados.`,
        }
      : {
          explore: 'Explore',
          allQuizzes: 'All quizzes',
          studio: 'Studio',
          manualCreator: 'Manual creator',
          aiGenerator: 'AI generator',
          account: 'Account',
          info: 'Info',
          leaderboard: 'Leaderboard',
          about: 'About',
          privacy: 'Privacy policy',
          terms: 'Terms',
          contact: 'Contact',
          rights: `Copyright ${currentYear} QuizVerse. All rights reserved.`,
        };

  return (
    <footer className="mt-auto border-t border-border-subtle bg-bg-secondary/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-[1.25fr_0.85fr_0.85fr_0.85fr]">
        <div className="space-y-4">
          <Link href={localizeHref(locale, '/')} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-bg-primary text-sm font-black uppercase tracking-[0.22em] text-accent-primary">
              QV
            </div>
            <span className="font-display text-lg font-semibold text-text-primary">QuizVerse</span>
          </Link>
          <p className="max-w-sm text-sm leading-6 text-text-muted">{dictionary.footer.tagline}</p>
        </div>

        <FooterColumn
          title={copy.explore}
          links={[
            { href: localizeHref(locale, '/quiz'), label: copy.allQuizzes },
            {
              href: localizeHref(locale, '/category/personality'),
              label: getLocalizedCategoryLabel('personality', locale),
            },
            {
              href: localizeHref(locale, '/category/trivia'),
              label: getLocalizedCategoryLabel('trivia', locale),
            },
            { href: localizeHref(locale, '/leaderboard'), label: copy.leaderboard },
          ]}
        />
        <FooterColumn
          title={copy.studio}
          links={[
            { href: localizeHref(locale, '/create'), label: copy.manualCreator },
            { href: localizeHref(locale, '/create/ai'), label: copy.aiGenerator },
            { href: localizeHref(locale, '/login'), label: copy.account },
          ]}
        />
        <FooterColumn
          title={copy.info}
          links={[
            { href: localizeHref(locale, '/about'), label: copy.about },
            { href: localizeHref(locale, '/privacy'), label: copy.privacy },
            { href: localizeHref(locale, '/terms'), label: copy.terms },
            { href: localizeHref(locale, '/contact'), label: copy.contact },
          ]}
        />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-border-subtle px-4 py-5 text-sm text-text-muted sm:flex-row">
        <p>{copy.rights}</p>
        <div className="flex items-center gap-4">
          <a href="https://twitter.com/quizverse" target="_blank" rel="noopener noreferrer">
            Twitter
          </a>
          <a href="https://github.com/quizverse" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-primary">
        {title}
      </p>
      <ul className="space-y-2 text-sm text-text-secondary">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="transition-colors hover:text-text-primary">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
