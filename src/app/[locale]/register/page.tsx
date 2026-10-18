import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegisterPageView } from '@/components/auth/register-page';
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
    title: es ? 'Crear cuenta' : 'Create account',
    description: es
      ? 'Crea tu cuenta de QuizVerse y empieza a publicar tus propios quizzes.'
      : 'Create your QuizVerse account and start publishing your own quizzes.',
    path: `/${lang}/register`,
    locale: lang,
    noindex: true,
    follow: false,
  });
}

export default async function LocalizedRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [{ locale }, { redirect }] = await Promise.all([params, searchParams]);
  if (!hasLocale(locale)) notFound();
  return <RegisterPageView redirectTo={redirect} locale={locale} />;
}
