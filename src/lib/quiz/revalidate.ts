import 'server-only';

/**
 * Qué revalidar cuando cambia un quiz (alta, edición, borrado o moderación).
 *
 * Vive en lib — no en quiz.actions.ts — porque un módulo 'use server' solo
 * puede exportar funciones async y estas las necesitan varias acciones.
 */

import { revalidatePath } from 'next/cache';
import { hasLocale, locales } from '@/lib/i18n/dictionaries';

/** Locales donde se lista un quiz: el suyo, o todos para idiomas desconocidos. */
export function quizLocales(language: string): readonly string[] {
  return hasLocale(language) ? [language] : locales;
}

/** Revalida home, explorar y detalle localizados del quiz, más los hubs. */
export function revalidateQuizPages(language: string, slug: string) {
  for (const locale of quizLocales(language)) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/quiz`);
    revalidatePath(`/${locale}/quiz/${slug}`);
  }
  // Category hubs and creator profiles list quizzes too. Their slug/username
  // aren't at hand without a join, so the dynamic routes go out wholesale.
  revalidatePath('/[locale]/category/[slug]', 'page');
  revalidatePath('/[locale]/profile/[username]', 'page');
}

/**
 * Feeds del catálogo: el sitemap (rewrite /sitemap.xml → /api/sitemap) y el
 * RSS por locale. Solo lo llaman las transiciones de estado — publicar o
 * rechazar mete o saca el quiz del índice — no las ediciones de contenido.
 */
export function revalidateCatalogFeeds(language: string) {
  revalidatePath('/api/sitemap');
  for (const locale of quizLocales(language)) {
    revalidatePath(`/${locale}/feed.xml`);
  }
}
