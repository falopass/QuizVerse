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

// Slug sintético del grupo final: reúne los quizzes publicados sin categoría.
// No hay página /category/uncategorized, así que nunca entra en `hubs`.
export const UNCATEGORIZED_GROUP_SLUG = 'uncategorized';

const UNCATEGORIZED_NAME: Record<Locale, string> = {
  es: 'Sin categoría',
  en: 'Uncategorized',
};

/**
 * Agrupa el catálogo publicado para la página /{locale}/indice. Todo quiz
 * publicado queda enlazado una sola vez: bajo su categoría o, si no tiene, en
 * el grupo sintético final `uncategorized`.
 */
export function buildCatalogIndex(quizzes: Quiz[], locale: Locale): CatalogIndex {
  const seen = new Set<string>();
  const byCategory = new Map<string, { name: string; quizzes: CatalogIndexQuiz[] }>();
  const typeCounts = new Map<string, number>();
  const uncategorized: CatalogIndexQuiz[] = [];
  let total = 0;

  for (const quiz of quizzes) {
    if (seen.has(quiz.slug)) continue;
    seen.add(quiz.slug);
    total += 1;
    typeCounts.set(quiz.quiz_type, (typeCounts.get(quiz.quiz_type) ?? 0) + 1);

    const category = localizeCategory(quiz.category, locale);
    if (!category) {
      uncategorized.push({ slug: quiz.slug, title: quiz.title });
      continue;
    }
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

  if (uncategorized.length > 0) {
    groups.push({
      slug: UNCATEGORIZED_GROUP_SLUG,
      name: UNCATEGORIZED_NAME[locale],
      quizzes: uncategorized.sort((a, b) => a.title.localeCompare(b.title, locale)),
    });
  }

  const typeHubSlugs = new Set<string>(TYPE_HUBS);
  const hubs: CatalogIndexHub[] = [
    ...TYPE_HUBS.filter((slug) => typeCounts.has(slug)).map((slug) => ({
      slug,
      name: getLocalizedTypeLabel(slug, locale),
      count: typeCounts.get(slug)!,
    })),
    // El catálogo de lanzamiento nombra categorías "trivia"/"personality": si un
    // grupo comparte slug con un hub de tipo, gana el de tipo y no se duplica.
    ...groups
      .filter((group) => group.slug !== UNCATEGORIZED_GROUP_SLUG && !typeHubSlugs.has(group.slug))
      .map((group) => ({ slug: group.slug, name: group.name, count: group.quizzes.length })),
  ];

  return { groups, hubs, total };
}
