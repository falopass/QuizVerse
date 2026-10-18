import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuizBySlug } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { buildMetadata } from '@/lib/seo/metadata';
import { quizOgImage } from '@/lib/seo/site';
import { QuizPlayer } from '@/components/quiz/quiz-player';

/**
 * The play view is the same quiz the detail page already ranks for, with no
 * text of its own. Indexing it would only create a duplicate URL, so it keeps
 * the stronger social preview and stays out of the index.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) return {};

  const es = locale === 'es';
  return buildMetadata({
    title: es ? `Jugando ${quiz.title}` : `Playing ${quiz.title}`,
    description: quiz.description,
    path: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}/play`,
    image: quizOgImage(locale, quiz.slug),
    imageAlt: quiz.title,
    locale,
    noindex: true,
  });
}

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
