import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditorialQuizCard } from '@/components/home/editorial-quiz-card';
import { getCategoryPayload } from '@/lib/data/public';
import { hasLocale } from '@/lib/i18n/dictionaries';
import { localizeCategory } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import { generateCategoryMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) {
    return {};
  }

  const payload = await getCategoryPayload(slug, locale);
  if (!payload) {
    return {};
  }

  const localizedCategory = localizeCategory(payload.category, locale)!;

  return generateCategoryMetadata({
    name: localizedCategory.name,
    slug,
    description:
      localizedCategory.description ||
      (locale === 'es'
        ? `Explora quizzes de ${localizedCategory.name} en QuizVerse.`
        : `Explore ${localizedCategory.name} quizzes on QuizVerse.`),
    locale,
  });
}

export default async function LocalizedCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  const payload = await getCategoryPayload(slug, locale);
  if (!payload) notFound();

  const category = localizeCategory(payload.category, locale)!;
  const categories = payload.categories.map((item) => localizeCategory(item, locale)!);
  const quizzes = payload.quizzes;
  const leadQuiz = quizzes[0] ?? null;
  const support = quizzes.slice(1, 7);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pt-28 pb-20">
      <section className="surface-panel p-8 md:p-10">
        <p className="eyebrow">{locale === 'es' ? 'Categoría' : 'Category'}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="flex items-center gap-4">
              <span className="border-border-subtle bg-bg-primary text-text-primary flex h-20 w-20 items-center justify-center rounded-[1.8rem] border text-4xl">
                {category.icon ?? 'Q'}
              </span>
              <div>
                <h1 className="text-text-primary text-4xl font-semibold tracking-tight md:text-6xl">
                  {category.name}
                </h1>
                <p className="text-text-secondary mt-3 max-w-2xl text-base leading-7">
                  {category.description}
                </p>
              </div>
            </div>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <MetricCard
              label={locale === 'es' ? 'Quizzes visibles' : 'Visible quizzes'}
              value={String(quizzes.length)}
            />
            <MetricCard
              label={locale === 'es' ? 'Carriles activos' : 'Active lanes'}
              value={String(categories.length)}
            />
          </div>
        </div>
      </section>

      <section className="surface-card mt-8 p-5 md:p-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href={localizeHref(locale, '/quiz')}
            className="border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors"
          >
            {locale === 'es' ? 'Todas las categorías' : 'All categories'}
          </Link>
          {categories.map((item) => (
            <Link
              key={item.id}
              href={localizeHref(locale, `/category/${item.slug}`)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors ${item.slug === slug ? 'border-accent-primary bg-accent-primary text-white' : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary'}`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      {leadQuiz ? (
        <section className="mt-8 grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <EditorialQuizCard quiz={leadQuiz} locale={locale} size="hero" />
          <div className="grid items-start gap-5 self-start md:grid-cols-2 xl:grid-cols-1">
            {support.slice(0, 3).map((quiz, index) => (
              <EditorialQuizCard
                key={quiz.id}
                quiz={quiz}
                locale={locale}
                index={index}
                size="compact"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {support.slice(3).map((quiz, index) => (
          <EditorialQuizCard key={quiz.id} quiz={quiz} index={index} locale={locale} />
        ))}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-subtle bg-bg-primary/80 rounded-[1.5rem] border p-5">
      <p className="text-text-muted text-[11px] font-semibold tracking-[0.2em] uppercase">
        {label}
      </p>
      <p className="text-text-primary mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}
