import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuizDetailPage } from '@/components/home/quiz-detail-page';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getPublishedQuizzes, getQuizBySlug } from '@/lib/data/public';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { buildMetadata } from '@/lib/seo/metadata';
import { quizOgImage } from '@/lib/seo/site';

export async function generateStaticParams() {
  const locales = ['en', 'es'] as const;
  const perLocale = await Promise.all(
    locales.map(async (locale) => {
      const quizzes = await getPublishedQuizzes(80, locale);
      return quizzes.map((quiz) => ({ locale, slug: quiz.slug }));
    })
  );
  return perLocale.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  const quiz = await getQuizBySlug(slug, locale);
  if (!quiz) {
    notFound();
  }

  const otherLocale = locale === 'es' ? 'en' : 'es';
  const equivalentSlug = getEquivalentQuizSlug(slug, otherLocale);
  const counterpart = equivalentSlug ? await getQuizBySlug(equivalentSlug, otherLocale) : null;

  const fallbackDescription =
    locale === 'es'
      ? `${quiz.questions.length} preguntas de ${quiz.title} en QuizVerse. Gratis, sin registro y con resultado al instante.`
      : `${quiz.questions.length} questions in ${quiz.title} on QuizVerse. Free, no signup, instant result.`;

  return buildMetadata({
    title: quiz.title,
    description: quiz.description ?? fallbackDescription,
    path: `/${locale}/quiz/${encodeURIComponent(quiz.slug)}`,
    // Only emit a translated hreflang when the translated quiz actually exists.
    alternatePath: counterpart
      ? `/${otherLocale}/quiz/${encodeURIComponent(counterpart.slug)}`
      : null,
    image: quizOgImage(locale, quiz.slug),
    imageAlt: quiz.title,
    locale,
    type: 'article',
    publishedTime: quiz.published_at,
    modifiedTime: quiz.updated_at,
    keywords: quiz.tags.slice(0, 8),
  });
}

export default async function LocalizedQuizDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  return <QuizDetailPage params={Promise.resolve({ locale, slug })} />;
}
