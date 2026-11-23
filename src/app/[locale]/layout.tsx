import { notFound } from 'next/navigation';
import { Footer } from '@/components/layout/footer';
import type { NavLabels } from '@/components/layout/floating-nav';
import { SiteShell } from '@/components/layout/site-shell';
import { SiteDocument } from '@/components/layout/site-document';
import { getPopulatedCategorySlugs } from '@/lib/data/category-counts';
import { CATEGORY_SLUG_NAMES } from '@/lib/i18n/catalog';
import { getDictionary, hasLocale, locales } from '@/lib/i18n/dictionaries';

export { metadata, viewport } from '@/components/layout/site-document';

// Literal exigido por Next; alineado con CATALOG_REVALIDATE_SECONDS.
// cookies/searchParams en las páginas privadas siguen optando por SSR.
export const revalidate = 300;

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(locale)) {
    notFound();
  }

  const [dictionary, populated] = await Promise.all([
    getDictionary(locale),
    getPopulatedCategorySlugs(locale),
  ]);
  // El footer solo enlaza hubs que existen en este idioma: uno vacío hace
  // notFound(), así que enlazarlo sería un 404 desde todas las páginas.
  const categorySlugs = Object.keys(CATEGORY_SLUG_NAMES).filter((slug) => populated.has(slug));
  const navLabels: NavLabels = {
    mainNavigation: dictionary.arcade.mainNavigation,
    explore: dictionary.common.explore,
    dailyQuiz: dictionary.common.dailyQuiz,
    leaderboard: dictionary.common.leaderboard,
    personality: dictionary.nav.personality,
    trivia: dictionary.nav.trivia,
    randomQuiz: dictionary.common.randomQuiz,
    mobileRandomQuiz: dictionary.nav.randomQuiz,
    switchLocale: dictionary.common.switchLocale,
    pickGame: dictionary.arcade.pickGame,
    menu: dictionary.nav.menu,
  };

  return (
    <SiteDocument locale={locale}>
      <SiteShell
        locale={locale}
        navLabels={navLabels}
        footer={<Footer dictionary={dictionary} locale={locale} categorySlugs={categorySlugs} />}
      >
        {children}
      </SiteShell>
    </SiteDocument>
  );
}
