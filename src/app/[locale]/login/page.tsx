import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginPageView } from '@/components/home/login-page';
import { hasLocale } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to QuizVerse to save progress, create quizzes, and keep your results close.',
  robots: { index: false, follow: false },
};

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
