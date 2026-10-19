import { NextResponse } from 'next/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { getRandomQuizSlug } from '@/lib/data/random-quiz';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) return new NextResponse(null, { status: 404 });

  const slug = await getRandomQuizSlug(locale);
  const target = localizeHref(locale, slug ? `/quiz/${slug}` : '/quiz');
  return NextResponse.redirect(new URL(target, request.url), 307);
}
