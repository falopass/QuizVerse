import { notFound } from 'next/navigation';
import { SiteDocument } from '@/components/layout/site-document';
import { hasLocale } from '@/lib/i18n/dictionaries';

export { metadata, viewport } from '@/components/layout/site-document';
export const dynamic = 'force-dynamic';

export default async function EmbedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  return <SiteDocument locale={locale}>{children}</SiteDocument>;
}
