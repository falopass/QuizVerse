import { redirect } from 'next/navigation';
import { localizeHref } from '@/lib/i18n/navigation';
import { getLocale } from '@/lib/i18n/server';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const locale = await getLocale();
  const { slug } = await params;

  redirect(localizeHref(locale, `/category/${slug}`));
}
