import { redirect } from 'next/navigation';
import { localizeHref } from '@/lib/i18n/navigation';
import { getLocale } from '@/lib/i18n/server';

export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const locale = await getLocale();
  const { redirect: nextRedirect } = await searchParams;
  const target = localizeHref(locale, '/login');

  redirect(nextRedirect ? `${target}?redirect=${encodeURIComponent(nextRedirect)}` : target);
}
