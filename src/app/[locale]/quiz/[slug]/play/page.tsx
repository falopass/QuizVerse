import { notFound } from 'next/navigation';
import { getQuizBySlug } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { QuizPlayer } from '@/components/quiz/quiz-player';

export default async function LocalizedQuizPlayPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) notFound();

  return <QuizPlayer quiz={quiz} locale={locale} />;
}
