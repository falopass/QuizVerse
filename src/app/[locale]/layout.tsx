import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/site-shell';
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

  const dictionary = await getDictionary(locale);

  return (
    <SiteShell locale={locale} dictionary={dictionary}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-accent-primary focus:px-6 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        {locale === 'es' ? 'Saltar al contenido' : 'Skip to content'}
      </a>
      {children}
    </SiteShell>
  );
}
