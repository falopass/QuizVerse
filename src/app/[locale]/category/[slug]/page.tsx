import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { getCategoryPayload } from '@/lib/data/public';
import { getDictionary, hasLocale } from '@/lib/i18n/dictionaries';
import { localizeCategory, localizeQuizList } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { generateCategoryMetadata } from '@/lib/seo/metadata';

type CategoryProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: CategoryProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const payload = await getCategoryPayload(slug, locale);
  if (!payload || payload.quizzes.length === 0) notFound();
  const category = localizeCategory(payload.category, locale)!;
  return generateCategoryMetadata({
    name: category.name, slug,
    description: category.description || (locale === 'es' ? `Explora quizzes de ${category.name} en QuizVerse.` : `Explore ${category.name} quizzes on QuizVerse.`),
    locale,
  });
}

export default async function LocalizedCategoryPage({ params }: CategoryProps) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const payload = await getCategoryPayload(slug, locale);
  if (!payload) notFound();
  if (payload.quizzes.length === 0) notFound();
  const dictionary = await getDictionary(locale);
  const category = localizeCategory(payload.category, locale)!;
  const quizzes = localizeQuizList(payload.quizzes, locale);

  return (
    <div className="arcade-wrap arcade-page arcade-category">
      <section className="arcade-category-hero">
        <span className="arcade-live">{dictionary.arcade.category} / {category.name}</span>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
        <strong>{quizzes.length} {dictionary.arcade.visibleGames}</strong>
      </section>
      <nav className="arcade-filters" aria-label={dictionary.arcade.allCategories}>
        <Link href={localizeHref(locale, '/quiz')}>{dictionary.arcade.allCategories}</Link>
        {payload.categories.map((item) => {
          const localized = localizeCategory(item, locale)!;
          return <Link key={item.id} href={localizeHref(locale, `/category/${item.slug}`)} aria-current={item.slug === slug ? 'page' : undefined}>{localized.name}</Link>;
        })}
      </nav>
      <div className="arcade-section-head"><h2>{dictionary.arcade.chooseGame}</h2><p>{dictionary.arcade.chooseBody}</p></div>
      <div className="arcade-grid">
        {quizzes.map((quiz) => <EditorialQuizCard key={quiz.id} quiz={quiz} locale={locale} />)}
      </div>
    </div>
  );
}
