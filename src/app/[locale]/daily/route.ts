import { NextResponse } from 'next/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { getDailyQuizSlug } from '@/lib/data/daily-quiz';

export const dynamic = 'force-dynamic';

// Enlace compartible del quiz de hoy: 307 al quiz que la home muestra como
// «quiz del día» (cambia a medianoche de Chile), o al explorador si no hay
// catálogo. No se indexa ni va en el sitemap: el destino cambia cada día.
export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) return new NextResponse(null, { status: 404 });

  const slug = await getDailyQuizSlug(locale);
  const target = localizeHref(locale, slug ? `/quiz/${slug}` : '/quiz');
  const response = NextResponse.redirect(new URL(target, request.url), 307);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}
