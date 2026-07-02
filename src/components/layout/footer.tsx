import Link from 'next/link';
import { getLocalizedCategoryLabel } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export function Footer({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
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
    <footer className="border-border-subtle bg-bg-primary mt-auto border-t">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-10 md:grid-cols-[1.25fr_0.85fr_0.85fr_0.85fr]">
        <div className="space-y-4">
          <Link href={localizeHref(locale, '/')} className="flex items-center gap-2.5">
            <div className="bg-text-primary text-bg-primary flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tracking-wider">
              QV
            </div>
            <span className="font-display text-text-primary text-lg font-semibold">QuizVerse</span>
          </Link>
          <p className="text-text-muted max-w-sm text-sm leading-relaxed">
            {dictionary.footer.tagline}
          </p>
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

      <div className="border-border-subtle text-text-muted mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 border-t px-4 py-5 text-sm sm:flex-row">
        <p>{copy.rights}</p>
        <div className="flex items-center gap-4">
          <a
            href="https://twitter.com/quizverse"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            Twitter
          </a>
          <a
            href="https://github.com/quizverse"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
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
      <span className="eyebrow mb-3 block">{title}</span>
      <ul className="text-text-secondary space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-text-primary transition-colors">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
