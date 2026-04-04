import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExploreEditorialPage } from '@/components/home/explore-editorial-page';
import { getExplorePayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { generateQuizMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  return generateQuizMetadata({
    title: locale === 'es' ? 'Explorar quizzes' : 'Explore quizzes',
    description:
      locale === 'es'
        ? 'Descubre el catálogo completo de QuizVerse por tema, vibra, ritmo e idioma.'
        : 'Discover the full QuizVerse catalog by topic, vibe, pace and language.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale}/quiz`,
    alternateUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://quizverse.org'}/${locale === 'es' ? 'en' : 'es'}/quiz`,
    locale,
  });
}

export default async function LocalizedQuizExplorerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const payload = await getExplorePayload(locale);

  return (
    <ExploreEditorialPage
      locale={locale}
      quizzes={payload.quizzes}
      categories={payload.categories}
      copy={{
        title: dictionary.explore.title,
        subtitle: dictionary.explore.subtitle,
        searchPlaceholder: dictionary.explore.searchPlaceholder,
        emptyTitle: dictionary.explore.emptyTitle,
        emptyBody: dictionary.explore.emptyBody,
        allCategories: dictionary.explore.allCategories,
        eyebrow: locale === 'es' ? 'Explorar' : 'Explore',
        visibleNow: locale === 'es' ? 'Visibles ahora' : 'Visible now',
        playsInView: locale === 'es' ? 'Partidas en vista' : 'Plays in view',
        publishedNow: locale === 'es' ? 'Publicados ahora' : 'Published now',
        searchLabel: locale === 'es' ? 'Buscar' : 'Search',
        categoryLanes: locale === 'es' ? 'Carriles de categoría' : 'Category lanes',
        leadPick: locale === 'es' ? 'Selección principal' : 'Lead pick',
        moreWaysIn: locale === 'es' ? 'Más caminos de entrada' : 'More ways in',
        quizzesAfterFilters: locale === 'es' ? 'quizzes tras filtros' : 'quizzes after filters',
      }}
    />
  );
}
