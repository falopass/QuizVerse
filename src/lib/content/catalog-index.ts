import type { Quiz } from '@/types/quiz';
import type { Locale } from '@/lib/i18n/dictionaries';
import { getLocalizedTypeLabel, localizeCategory } from '@/lib/i18n/catalog';

export interface CatalogIndexQuiz {
  slug: string;
  title: string;
}

export interface CatalogIndexGroup {
  slug: string;
  name: string;
  quizzes: CatalogIndexQuiz[];
}

export interface CatalogIndexHub {
  slug: string;
  name: string;
  count: number;
}

export interface CatalogIndex {
  groups: CatalogIndexGroup[];
  hubs: CatalogIndexHub[];
  total: number;
}

// Type hubs are the only quiz_type values with their own /category/<slug> page.
const TYPE_HUBS = ['trivia', 'personality'] as const;

/**
 * Agrupa el catálogo publicado para la página /{locale}/indice. Quizzes sin
 * categoría cuentan en `total` pero no tienen grupo donde colgarlos; los slugs
 * duplicados se enlazan una sola vez.
 */
export function buildCatalogIndex(quizzes: Quiz[], locale: Locale): CatalogIndex {
  const seen = new Set<string>();
  const byCategory = new Map<string, { name: string; quizzes: CatalogIndexQuiz[] }>();
  const typeCounts = new Map<string, number>();
  let total = 0;

  for (const quiz of quizzes) {
    if (seen.has(quiz.slug)) continue;
    seen.add(quiz.slug);
    total += 1;
    typeCounts.set(quiz.quiz_type, (typeCounts.get(quiz.quiz_type) ?? 0) + 1);

    const category = localizeCategory(quiz.category, locale);
    if (!category) continue;
    const entry = byCategory.get(category.slug) ?? { name: category.name, quizzes: [] };
    entry.quizzes.push({ slug: quiz.slug, title: quiz.title });
    byCategory.set(category.slug, entry);
  }

  const groups = [...byCategory.entries()]
    .map(([slug, group]) => ({
      slug,
      name: group.name,
      quizzes: group.quizzes.sort((a, b) => a.title.localeCompare(b.title, locale)),
    }))
    .sort((a, b) => b.quizzes.length - a.quizzes.length || a.name.localeCompare(b.name, locale));

  const hubs: CatalogIndexHub[] = [
    ...TYPE_HUBS.filter((slug) => typeCounts.has(slug)).map((slug) => ({
      slug,
      name: getLocalizedTypeLabel(slug, locale),
      count: typeCounts.get(slug)!,
    })),
    ...groups.map((group) => ({ slug: group.slug, name: group.name, count: group.quizzes.length })),
  ];

  return { groups, hubs, total };
}
