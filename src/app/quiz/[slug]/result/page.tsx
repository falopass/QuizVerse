import { redirect } from 'next/navigation';
import { localizeHref } from '@/lib/i18n/navigation';
import { getLocale } from '@/lib/i18n/server';

export default async function QuizResultRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const locale = await getLocale();
  const [{ slug }, { s }] = await Promise.all([params, searchParams]);
  const target = localizeHref(locale, `/quiz/${slug}/result`);

  redirect(s ? `${target}?s=${encodeURIComponent(s)}` : target);
}
