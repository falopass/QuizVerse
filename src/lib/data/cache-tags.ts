/**
 * Tags y ventana de la caché de datos del catálogo público.
 *
 * `src/lib/data/public.ts` y `category-counts.ts` guardan sus lecturas en
 * `unstable_cache` con estos tags; las acciones que publican, editan,
 * despublican o moderan quizzes los invalidan con `revalidateTag` (ver
 * `src/lib/quiz/revalidate.ts`). `categories` solo cambia por migración, así
 * que no tiene invalidación manual: vence con el `revalidate`.
 */

export const CATALOG_REVALIDATE_SECONDS = 300;

export const CATALOG_TAGS = {
  quizzes: 'quizzes',
  categories: 'categories',
  quiz: (slug: string) => `quiz:${slug}`,
} as const;
