import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginPageView } from '@/components/home/login-page';
import { hasLocale } from '@/lib/i18n/dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'es' ? 'Iniciar sesión' : 'Sign In',
    description: locale === 'es' ? 'Inicia sesión en QuizVerse para guardar tu progreso y crear quizzes.' : 'Sign in to QuizVerse to save progress and create quizzes.',
    robots: { index: false, follow: false },
  };
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
