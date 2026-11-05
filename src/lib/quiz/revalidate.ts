import 'server-only';

/**
 * Qué revalidar cuando cambia un quiz (alta, edición, borrado o moderación).
 *
 * Vive en lib — no en quiz.actions.ts — porque un módulo 'use server' solo
 * puede exportar funciones async y estas las necesitan varias acciones.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOG_TAGS } from '@/lib/data/cache-tags';
import { hasLocale, locales } from '@/lib/i18n/dictionaries';

/** Locales donde se lista un quiz: el suyo, o todos para idiomas desconocidos. */
export function quizLocales(language: string): readonly string[] {
  return hasLocale(language) ? [language] : locales;
}

/**
 * Revalida home, explorar y detalle localizados del quiz, más los hubs.
 *
 * `revalidatePath` no purga la caché de datos (`unstable_cache`): los tags van
 * aparte. `expire: 0` hace que la siguiente lectura espere a la revalidación
 * en vez de servir la versión vieja, para que quien publica o edita vea el
 * catálogo ya actualizado.
 */
export function revalidateQuizPages(language: string, slug: string) {
  for (const locale of quizLocales(language)) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/quiz`);
    revalidatePath(`/${locale}/quiz/${slug}`);
    // El reto diario juega con un quiz publicado: retirarlo o cambiar sus
    // preguntas debe refrescar también la página cacheada de /daily.
    revalidatePath(`/${locale}/daily`);
  }
  // Category hubs and creator profiles list quizzes too. Their slug/username
  // aren't at hand without a join, so the dynamic routes go out wholesale.
  // Los hubs de fandom también: agrupan por título, así que cualquier cambio
  // de quiz puede crearlos, moverlos o hacerlos desaparecer.
  revalidatePath('/[locale]/category/[slug]', 'page');
  revalidatePath('/[locale]/fandom/[slug]', 'page');
  revalidatePath('/[locale]/profile/[username]', 'page');
  revalidateTag(CATALOG_TAGS.quizzes, { expire: 0 });
  revalidateTag(CATALOG_TAGS.quiz(slug), { expire: 0 });
}

/**
 * Feeds del catálogo: el sitemap (rewrite /sitemap.xml → /api/sitemap) y el
 * RSS por locale. Solo lo llaman las transiciones de estado — publicar o
 * rechazar mete o saca el quiz del índice — no las ediciones de contenido.
 * Los datos publicados ya quedan invalidados por `revalidateQuizPages`.
 */
export function revalidateCatalogFeeds(language: string) {
  revalidatePath('/api/sitemap');
  for (const locale of quizLocales(language)) {
    revalidatePath(`/${locale}/feed.xml`);
  }
}
