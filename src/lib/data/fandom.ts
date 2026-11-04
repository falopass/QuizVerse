/**
 * Capa de datos de los hubs de fandom (`/{locale}/fandom/{slug}`).
 *
 * Los grupos se derivan de los títulos publicados (ver
 * `src/lib/content/franchise.ts`) sobre la misma fila ligera y cacheada que
 * sirve `/[locale]/quiz`: una consulta por idioma cada 300 s, compartida con
 * el explorador, la ficha y esta página.
 */

import 'server-only';

import { cache } from 'react';
import { getExplorePayload } from '@/lib/data/public';
import { getEquivalentQuizSlug } from '@/lib/data/quiz-locale-map';
import { buildFandomHubs, pairedFandomSlug, type FandomHub } from '@/lib/content/franchise';
import type { Locale } from '@/lib/i18n/dictionaries';
import type { ExploreCardQuiz } from '@/types/quiz';

export type FandomCardQuiz = ExploreCardQuiz & { published_at?: string | null };
export type FandomQuizHub = FandomHub<FandomCardQuiz>;

// El explorador ya cachea la lista publicada por idioma; si la consulta cae,
// `getExplorePayload` sirve el catálogo de lanzamiento — mismas reglas de
// agrupación, así que la degradación es coherente con el resto del sitio.
const getFandomHubs = cache(async (locale: Locale): Promise<Map<string, FandomQuizHub>> => {
  const { quizzes } = await getExplorePayload(locale);
  return buildFandomHubs(quizzes as FandomCardQuiz[], locale);
});

async function getFandomHubsByLocale(): Promise<Record<Locale, Map<string, FandomQuizHub>>> {
  const [en, es] = await Promise.all([getFandomHubs('en'), getFandomHubs('es')]);
  return { en, es };
}

/** Hub por slug, o `null` cuando no existe (menos de 3 quizzes en el idioma). */
export async function getFandomHub(locale: Locale, slug: string): Promise<FandomQuizHub | null> {
  const hubs = await getFandomHubs(locale);
  return hubs.get(slug) ?? null;
}

/**
 * Slug del hub equivalente en el otro idioma, solo cuando esa página existe
 * de verdad (su franquicia también tiene ≥3 quizzes allí). Alimenta el
 * `alternatePath` de la metadata: un hreflang a 404 es peor que ninguno.
 */
export async function getFandomAlternateSlug(locale: Locale, slug: string): Promise<string | null> {
  const hubsByLocale = await getFandomHubsByLocale();
  return pairedFandomSlug(hubsByLocale, locale, slug, getEquivalentQuizSlug);
}

/**
 * El hub al que pertenece un quiz, para el bloque «Más de {franquicia}» de la
 * ficha. `null` si el quiz no tiene franquicia reconocible o su grupo no
 * llega al mínimo: la ficha simplemente no muestra el bloque.
 */
export async function getQuizFandom(
  locale: Locale,
  quizSlug: string
): Promise<FandomQuizHub | null> {
  const hubs = await getFandomHubs(locale);
  for (const hub of hubs.values()) {
    if (hub.quizzes.some((quiz) => quiz.slug === quizSlug)) return hub;
  }
  return null;
}

/** Slugs de todos los hubs del idioma (para sitemap y tests). */
export async function getFandomHubSlugs(locale: Locale): Promise<string[]> {
  return [...(await getFandomHubs(locale)).keys()];
}
