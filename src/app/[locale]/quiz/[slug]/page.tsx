import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuizDetailPage, generateQuizDetailStaticParams } from '@/components/home/quiz-detail-page';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { getQuizBySlug } from '@/lib/data/public';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { generateQuizMetadata } from '@/lib/seo/metadata';

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

  return generateQuizMetadata({
    title: quiz.title,
    description:
      quiz.description ??
      (locale === 'es' ? 'Juega este quiz en QuizVerse.' : 'Play this quiz on QuizVerse.'),
    image: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale}/quiz/${quiz.slug}/opengraph-image`,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale}/quiz/${quiz.slug}`,
    alternateUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${otherLocale}${counterpart ? `/quiz/${counterpart.slug}` : ''}`,
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
