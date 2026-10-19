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
      {children}
    </SiteShell>
  );
}
