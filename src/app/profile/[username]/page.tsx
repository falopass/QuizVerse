import { redirect } from 'next/navigation';
import { localizeHref } from '@/lib/i18n/navigation';
import { getLocale } from '@/lib/i18n/server';

export default async function ProfileRedirect({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const locale = await getLocale();
  const { username } = await params;

  redirect(localizeHref(locale, `/profile/${username}`));
}
