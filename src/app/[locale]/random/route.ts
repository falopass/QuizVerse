import { NextResponse } from 'next/server';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeHref } from '@/lib/i18n/navigation';
import { getRandomQuizSlug } from '@/lib/data/random-quiz';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) return new NextResponse(null, { status: 404 });

  // Con quiz, el azar entra directo a la primera pregunta (modo Clásico, que
  // el parser de modos acepta para trivia y personalidad): un clic, una
  // pregunta. Sin datos (catálogo vacío o Supabase caído), vuelve a Explorar.
  const slug = await getRandomQuizSlug(locale);
  const target = localizeHref(
    locale,
    slug ? `/quiz/${encodeURIComponent(slug)}/play?mode=classic` : '/quiz'
  );
  return NextResponse.redirect(new URL(target, request.url), 307);
}
