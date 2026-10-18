import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuizDetailPage, generateQuizDetailStaticParams } from '@/components/home/quiz-detail-page';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getQuizBySlug } from '@/lib/data/public';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { buildMetadata } from '@/lib/seo/metadata';
import { quizOgImage } from '@/lib/seo/site';

export async function generateStaticParams() {
  const slugs = await generateQuizDetailStaticParams();
  return ['en', 'es'].flatMap((locale) => slugs.map((entry) => ({ locale, ...entry })));
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
