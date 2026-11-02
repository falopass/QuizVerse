import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FollowListPage } from '@/components/profile/follow-list';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  const es = locale === 'es';
  return buildMetadata({
    title: es ? `A quién sigue @${username}` : `Who @${username} follows`,
    description: es
      ? `Los perfiles que sigue @${username} en QuizVerse.`
      : `The profiles @${username} follows on QuizVerse.`,
    path: `/${locale}/profile/${encodeURIComponent(username)}/following`,
    locale,
    // Igual que el perfil: contenido generado por usuarios, fuera del índice.
    noindex: true,
  });
}

export default async function LocalizedFollowingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ locale, username }, { page }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();

  const pageNumber = Number(page);
  return (
    <FollowListPage
      locale={locale}
      username={username}
      kind="following"
      page={Number.isSafeInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1}
    />
  );
}
