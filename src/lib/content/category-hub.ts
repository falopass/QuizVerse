import type { Locale } from '@/lib/i18n/dictionaries';
import { localizeCategory } from '@/lib/i18n/catalog';
import { localizeHref } from '@/lib/i18n/navigation';
import type { Category } from '@/types/quiz';

export interface CategoryHubCopy {
  eyebrow: string;
  title: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  sectionCategories: string;
  sectionTypes: string;
  quizLabel: string;
}

export interface CategoryHubItem {
  slug: string;
  name: string;
  description: string | null;
  count: number;
  href: string;
  kind: 'category' | 'type';
}

const HUB_COPY: Record<Locale, CategoryHubCopy> = {
  es: {
    eyebrow: 'QuizVerse',
    title: 'Todas las categorías',
    intro:
      'El catálogo completo ordenado por tema y por formato. Elige una categoría para ver sus quizzes o entra por trivia y personalidad si lo que buscas es un tipo de juego concreto. Cada tarjeta muestra cuántos quizzes hay publicados en este idioma.',
    metaTitle: 'Todas las categorías de quizzes',
    metaDescription:
      'Todas las categorías de QuizVerse con su número real de quizzes en español, más los hubs de trivia y personalidad. Elige un tema y juega gratis, sin registro.',
    sectionCategories: 'Categorías por tema',
    sectionTypes: 'Por tipo de quiz',
    quizLabel: 'quizzes',
  },
  en: {
    eyebrow: 'QuizVerse',
    title: 'All categories',
    intro:
      'The full catalogue organised by theme and by format. Pick a category to see its quizzes, or jump into the trivia and personality hubs when you know the kind of game you want. Every card shows how many quizzes are published in this language.',
    metaTitle: 'All quiz categories',
    metaDescription:
      'Every QuizVerse category with its real quiz count in English, plus the trivia and personality hubs. Pick a theme and play free, no signup needed.',
    sectionCategories: 'Categories by topic',
    sectionTypes: 'By quiz type',
    quizLabel: 'quizzes',
  },
};

export function categoryHubCopy(locale: Locale): CategoryHubCopy {
  return HUB_COPY[locale];
}

const TYPE_HUB_SLUGS = ['trivia', 'personality'] as const;

// Los hubs de tipo no existen en la tabla categories: este stub solo reutiliza
// el copy localizado que localizeCategory ya tiene para trivia/personality.
function typeStub(slug: string): Category {
  return {
    id: slug,
    slug,
    name: slug,
    description: null,
    icon: null,
    color: null,
    gradient_from: null,
    gradient_to: null,
    quiz_count: 0,
    sort_order: 0,
  };
}

/**
 * Lista el hub /{locale}/categories: categorías con al menos un quiz publicado
 * (una categoría vacía hace notFound() en /category/[slug], nunca se enlaza)
 * más los dos hubs de tipo, que van siempre aunque el conteo no llegue.
 * Orden: conteo descendente y, a igualdad, nombre localizado.
 */
export function buildCategoryHub(
  categories: Category[],
  counts: ReadonlyMap<string, number>,
  typeCounts: ReadonlyMap<string, number>,
  locale: Locale
): CategoryHubItem[] {
  const items: CategoryHubItem[] = [];

  for (const category of categories) {
    const count = counts.get(category.slug) ?? 0;
    if (count <= 0) continue;
    const localized = localizeCategory(category, locale) ?? category;
    items.push({
      slug: category.slug,
      name: localized.name,
      description: localized.description,
      count,
      href: localizeHref(locale, `/category/${category.slug}`),
      kind: 'category',
    });
  }

  for (const slug of TYPE_HUB_SLUGS) {
    const localized = localizeCategory(typeStub(slug), locale);
    items.push({
      slug,
      name: localized?.name ?? slug,
      description: localized?.description ?? null,
      count: typeCounts.get(slug) ?? 0,
      href: localizeHref(locale, `/category/${slug}`),
      kind: 'type',
    });
  }

  return items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
}
