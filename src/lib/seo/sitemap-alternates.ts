/**
 * Cálculo de los `alternates` (hreflang) del sitemap.
 *
 * Regla que justifica este módulo: un `hreflang` sólo puede apuntar a una página
 * que exista de verdad. Si una categoría tiene quizzes publicados únicamente en
 * inglés, `/{es}/category/...` hace `notFound()`: declararla como versión
 * española es peor que no declarar nada, porque Google acaba rastreando un 404
 * que el propio sitemap anunció.
 *
 * Por eso cada función recibe el índice real de contenido publicado y devuelve
 * `undefined` cuando la pareja no existe. Es puro: sin base de datos, sin red.
 */

import type { Locale } from '@/lib/i18n/dictionaries';
import type { SitemapAlternate } from './sitemap';

/** locale → conjunto de slugs que tienen página en ese idioma. */
export type SlugIndex = Map<Locale, Set<string>>;

function otherLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}

function has(index: SlugIndex, locale: Locale, slug: string): boolean {
  return index.get(locale)?.has(slug) ?? false;
}

/**
 * Alternates de una página editorial que existe en ambos idiomas con la misma
 * ruta (`/en/about` y `/es/about`). Aquí no hay nada que comprobar: la ruta se
 * genera para los dos locales por construcción.
 */
export function sharedPathAlternates(path: string): SitemapAlternate[] {
  const en = `/en${path}`;
  const es = `/es${path}`;
  return [
    { hreflang: 'en', href: en },
    { hreflang: 'es', href: es },
    { hreflang: 'x-default', href: en },
  ];
}

/**
 * Alternates de un hub de categoría o de tipo (`/{locale}/category/{slug}`).
 *
 * Devuelve `undefined` si el slug no está publicado en el otro idioma: esa URL
 * respondería 404 y no debe anunciarse.
 */
export function hubAlternates(
  locale: Locale,
  slug: string,
  hubs: SlugIndex
): SitemapAlternate[] | undefined {
  const other = otherLocale(locale);
  if (!has(hubs, locale, slug) || !has(hubs, other, slug)) return undefined;

  const self = `/${locale}/category/${slug}`;
  const translated = `/${other}/category/${slug}`;

  return [
    { hreflang: locale, href: self },
    { hreflang: other, href: translated },
    { hreflang: 'x-default', href: locale === 'en' ? self : translated },
  ];
}

/**
 * Alternates de un quiz.
 *
 * Doble comprobación: el mapa de traducciones tiene que conocer la pareja
 * (`counterpart`) y esa pareja tiene que estar publicada. El mapa se escribió a
 * mano y puede quedarse atrás; los slugs publicados los manda la base.
 */
export function quizAlternates(
  locale: Locale,
  slug: string,
  counterpart: string | null,
  published: SlugIndex
): SitemapAlternate[] | undefined {
  if (!counterpart) return undefined;

  const other = otherLocale(locale);
  if (!has(published, other, counterpart)) return undefined;

  const self = `/${locale}/quiz/${encodeURIComponent(slug)}`;
  const translated = `/${other}/quiz/${encodeURIComponent(counterpart)}`;

  return [
    { hreflang: locale, href: self },
    { hreflang: other, href: translated },
    { hreflang: 'x-default', href: locale === 'en' ? self : translated },
  ];
}
