import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getPublishedQuizzes } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildAtomFeed } from '@/lib/seo/feed';

export const revalidate = 3600;

const FEED_LIMIT = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  // getPublishedQuizzes ordena por plays_count; el feed necesita lo más reciente.
  const quizzes = (await getPublishedQuizzes(FEED_LIMIT, locale))
    .sort(
      (a, b) =>
        new Date(b.published_at ?? b.created_at).getTime() -
        new Date(a.published_at ?? a.created_at).getTime()
    )
    .slice(0, FEED_LIMIT);

  const newest = quizzes[0];
  const updated = newest
    ? new Date(newest.updated_at ?? newest.published_at ?? newest.created_at).toISOString()
    : new Date().toISOString();

  return new NextResponse(buildAtomFeed({ locale, quizzes, updated }), {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
}
