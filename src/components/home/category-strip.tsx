import Link from 'next/link';
import type { Category } from '@/types/quiz';
import { getDictionary, type Locale } from '@/lib/i18n/dictionaries';
import { localizeCategory } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';

const MAX_HOME_CATEGORIES = 16;

export async function CategoryStrip({
  categories,
  locale,
}: {
  categories: Category[];
  locale: Locale;
}) {
  const visible = categories
    .filter((category) => category.quiz_count > 0)
    .sort((a, b) => b.quiz_count - a.quiz_count)
    .slice(0, MAX_HOME_CATEGORIES);
  if (visible.length === 0) return null;

  const dictionary = await getDictionary(locale);

  return (
    <section className="arcade-related">
      <div className="arcade-section-head">
        <h2>{dictionary.home.sections.categories}</h2>
        <p>{dictionary.arcade.allCategories}</p>
      </div>
      <nav className="arcade-filters" aria-label={dictionary.arcade.allCategories}>
        {visible.map((category) => (
          <Link key={category.id} href={localizeHref(locale, `/category/${category.slug}`)}>
            {localizeCategory(category, locale)?.name ?? category.name} · {category.quiz_count}
          </Link>
        ))}
      </nav>
    </section>
  );
}
