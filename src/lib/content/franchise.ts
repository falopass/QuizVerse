/**
 * Franquicias (fandoms) del catálogo, derivadas del título de cada quiz.
 *
 * Los lotes editoriales nombran los quizzes por plantilla: cada franquicia
 * recibe la misma familia de títulos en cada idioma («Trivia fan de Frieren»,
 * «¿Qué energía de Frieren combina mejor contigo?», «Which Frieren energy
 * matches you best?», …). `extractFranchise` reconoce solo esas plantillas:
 * el nombre queda delimitado por las partes fijas, así que la extracción es
 * segura. Las plantillas genéricas (`Trivia de X`, `X Trivia: …`) mezclan
 * temas con franquicias y fragmentan («Trivia de los villanos de Disney»
 * agruparía aparte de «Trivia de Disney»); ante la duda se devuelve `null`.
 *
 * El módulo es puro: sin I/O, sin red, sin base de datos. Las páginas y el
 * sitemap le inyectan el catálogo y el mapa de pares de idioma.
 */

import type { Locale } from '@/lib/i18n/dictionaries';

/** Un hub de fandom solo existe con este mínimo de quizzes en el idioma. */
export const FANDOM_MIN_QUIZZES = 3;

/**
 * Plantillas por idioma. Cada regex captura ÚNICAMENTE el nombre de la
 * franquicia; el resto del título es literal. En `en`, «fan trivia» va antes
 * que «trivia challenge»: «Disney Fan Trivia Challenge» debe dar «Disney»,
 * no «Disney Fan». El sufijo `: subtopic` se descarta («Trivia fan de Los
 * Simpson: Springfield» → «Los Simpson») pero solo con espacio tras los dos
 * puntos, para no mutilar nombres como «Re:ZERO».
 */
const TITLE_TEMPLATES: Record<Locale, RegExp[]> = {
  en: [
    /^(.+?)\s+fan trivia(?:\s+challenge)?(?::\s.*)?$/i,
    /^(.+?)\s+trivia challenge$/i,
    /^which\s+(.+?)\s+energy\s+matches\s+you\s+best\??$/i,
    /^what\s+role\s+would\s+you\s+play\s+inside\s+(.+?)\??$/i,
    /^how\s+deep\s+does\s+your\s+(.+?)\s+knowledge\s+go\??$/i,
  ],
  es: [
    /^trivia\s+fan\s+de(?:l)?\s+(.+?)(?::\s.*)?$/i,
    /^¿?qué\s+energía\s+de\s+(.+?)\s+combina\s+mejor\s+contigo\??$/i,
    /^¿?qué\s+rol\s+jugarías\s+(?:en|dentro\s+de(?:l)?)\s+(.+?)\??$/i,
    /^¿?qué\s+tan\s+profundo\s+llega\s+tu\s+conocimiento\s+de\s+(.+?)\??$/i,
  ],
};

function cleanFranchiseName(raw: string): string | null {
  const name = raw
    .split(/:\s/, 1)[0]
    .replace(/\s+/g, ' ')
    .replace(/[?!.\s]+$/, '')
    .trim();
  return /[\p{L}\p{N}]/u.test(name) ? name : null;
}

/**
 * Nombre de la franquicia que el título anuncia en `locale`, o `null` cuando
 * el título no sigue una plantilla de franquicia. Un `null` siempre es mejor
 * que un grupo equivocado: el quiz simplemente no tiene hub.
 */
export function extractFranchise(title: string, locale: Locale): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  for (const template of TITLE_TEMPLATES[locale]) {
    const match = template.exec(trimmed);
    if (match?.[1]) {
      const name = cleanFranchiseName(match[1]);
      if (name) return name;
    }
  }
  return null;
}

/** Slug ASCII estable del hub: `/[locale]/fandom/{slug}`. */
export function franchiseSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72)
    .replace(/-+$/g, '');
}

/** Hub de una franquicia: slug de su página, nombre para el H1 y miembros. */
export interface FandomHub<Q> {
  slug: string;
  name: string;
  quizzes: Q[];
}

/**
 * Agrupa los quizzes de un idioma por franquicia y conserva solo los grupos
 * con `FANDOM_MIN_QUIZZES` o más miembros (el umbral con el que la página
 * existe; menos es una página fina). El orden de `quizzes` se conserva
 * dentro de cada grupo, así que la entrada más jugada queda primera.
 *
 * Dos nombres que comparten slug («Pokémon» / «Pokemon») se funden en un
 * solo grupo; el nombre que se muestra es el del primer miembro visto.
 */
export function buildFandomHubs<Q extends { slug: string; title: string }>(
  quizzes: Q[],
  locale: Locale
): Map<string, FandomHub<Q>> {
  const hubs = new Map<string, FandomHub<Q>>();
  for (const quiz of quizzes) {
    const name = extractFranchise(quiz.title, locale);
    if (!name) continue;
    const slug = franchiseSlug(name);
    if (!slug) continue;
    const hub = hubs.get(slug) ?? { slug, name, quizzes: [] };
    hub.quizzes.push(quiz);
    hubs.set(slug, hub);
  }
  for (const [slug, hub] of hubs) {
    if (hub.quizzes.length < FANDOM_MIN_QUIZZES) hubs.delete(slug);
  }
  return hubs;
}

function quizHubIndex<Q extends { slug: string }>(
  hubs: Map<string, FandomHub<Q>>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const hub of hubs.values()) {
    for (const quiz of hub.quizzes) index.set(quiz.slug, hub.slug);
  }
  return index;
}

/**
 * Slug del hub hermano en el otro idioma, o `null` si no hay pareja segura.
 *
 * Los nombres no se traducen solos («El Juego del Calamar» ↔ «Squid Game»),
 * así que la pareja se infiere del mapa de quizzes bilingües: cada miembro
 * del hub vota por el hub del otro idioma que contiene a su par. Se exige
 * mayoría estricta de los votos emitidos; un empate o una dispersión no
 * justifican anunciar una traducción (un hreflang a 404 es peor que ninguno).
 */
export function pairedFandomSlug<Q extends { slug: string }>(
  hubsByLocale: Record<Locale, Map<string, FandomHub<Q>>>,
  locale: Locale,
  slug: string,
  counterpartOf: (quizSlug: string, target: Locale) => string | null
): string | null {
  const hub = hubsByLocale[locale].get(slug);
  if (!hub) return null;
  const other: Locale = locale === 'es' ? 'en' : 'es';
  const otherIndex = quizHubIndex(hubsByLocale[other]);

  const votes = new Map<string, number>();
  let cast = 0;
  for (const quiz of hub.quizzes) {
    const counterpart = counterpartOf(quiz.slug, other);
    if (!counterpart) continue;
    const target = otherIndex.get(counterpart);
    if (!target) continue;
    cast += 1;
    votes.set(target, (votes.get(target) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerVotes = 0;
  for (const [candidate, count] of votes) {
    if (count > winnerVotes) {
      winner = candidate;
      winnerVotes = count;
    }
  }
  return winner !== null && winnerVotes * 2 > cast ? winner : null;
}

/**
 * Categoría dominante del hub (la que más miembros tienen), para el enlace a
 * `/category/{slug}` y el párrafo de intro. `null` si ningún miembro la tiene.
 */
export function dominantCategory<Q extends { category?: { slug: string; name: string } | null }>(
  quizzes: Q[]
): { slug: string; name: string } | null {
  const counts = new Map<string, { name: string; count: number }>();
  for (const quiz of quizzes) {
    const category = quiz.category;
    if (!category?.slug) continue;
    const entry = counts.get(category.slug) ?? { name: category.name, count: 0 };
    entry.count += 1;
    counts.set(category.slug, entry);
  }
  let best: { slug: string; name: string } | null = null;
  let bestCount = 0;
  for (const [slug, entry] of counts) {
    if (entry.count > bestCount) {
      best = { slug, name: entry.name };
      bestCount = entry.count;
    }
  }
  return best;
}
