import { redirect } from 'next/navigation';
import { localizeHref } from '@/lib/i18n/navigation';
import { getLocale } from '@/lib/i18n/server';

export default async function PrivacyRedirect() {
  const locale = await getLocale();
  redirect(localizeHref(locale, '/privacy'));
}
