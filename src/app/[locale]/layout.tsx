import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/site-shell';
import { getPopulatedCategorySlugs } from '@/lib/data/category-counts';
import { CATEGORY_SLUG_NAMES } from '@/lib/i18n/catalog';
import { getDictionary, hasLocale, locales } from '@/lib/i18n/dictionaries';

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

  return (
    <SiteShell locale={locale} dictionary={dictionary} categorySlugs={categorySlugs}>
      {children}
    </SiteShell>
  );
}
