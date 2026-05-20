import { getCanonicalCategorySlug, translateCategorySlug } from './category-slugs';
import { Locale } from './dictionaries';

/**
 * Traduce un slug de categoría al idioma especificado
 */
export function getLocalizedCategorySlugForUrl(slug: string, targetLocale: Locale): string {
  return translateCategorySlug(slug, targetLocale);
}

/**
 * Convierte un slug de categoría localizado al slug canónico (en inglés)
 * Usado para consultas a la base de datos
 */
export function getCategorySlugForDb(slug: string): string {
  return getCanonicalCategorySlug(slug);
}

/**
 * Función para usar en los archivos de ruta (como [slug]/page.tsx)
 * Toma el slug del parámetro y lo convierte al slug canónico para la base de datos
 */
export function getCategorySlugFromParam(paramSlug: string, currentLocale: Locale): string {
  // Si estamos en español y recibimos 'personalidad', devolver 'personality'
  // Si estamos en inglés y recibimos 'personality', devolver 'personality'
  return getCategorySlugForDb(paramSlug);
}

/**
 * Genera una URL de categoría con el slug localizado según el idioma
 */
export function buildLocalizedCategoryUrl(slug: string, locale: Locale): string {
  const localizedSlug = getLocalizedCategorySlugForUrl(slug, locale);
  return `/${locale}/category/${localizedSlug}`;
}
