import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginPageView } from '@/components/home/login-page';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = hasLocale(locale) ? locale : 'en';
  const es = lang === 'es';
  return buildMetadata({
    title: es ? 'Iniciar sesión' : 'Sign in',
    description: es
      ? 'Inicia sesión en QuizVerse para guardar tu progreso y crear quizzes.'
      : 'Sign in to QuizVerse to save progress and create quizzes.',
    path: `/${lang}/login`,
    locale: lang,
    noindex: true,
    follow: false,
  });
}

export default async function LocalizedLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [{ locale }, { redirect }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();
  return <LoginPageView redirectTo={redirect} locale={locale} />;
}
