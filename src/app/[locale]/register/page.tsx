import { hasLocale } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegisterPageView } from '@/components/auth/register-page';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your QuizVerse account and start creating quizzes.',
  robots: { index: false, follow: false },
};

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
