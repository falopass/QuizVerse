import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LocaleNotFoundContent } from '@/components/layout/locale-not-found';

// Next 16.4.2 responde a un notFound() lanzado durante el SSR con su shell de
// error (<html id="__next_error__">): el root layout no llega al HTML, así que
// el documento se queda sin `lang` hasta la hidratación (vercel/next.js#99793;
// el fix #98583 sigue abierto). El <title> sí llega al <head> del shell porque
// Next resuelve la metadata con errorType 'not-found' desde este archivo.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const es = locale ? locale === 'es' : (await headers()).get('x-quizverse-locale') === 'es';
  return { title: es ? 'Página no encontrada' : 'Page not found' };
}

export default function LocaleNotFound() {
  return <LocaleNotFoundContent />;
}
