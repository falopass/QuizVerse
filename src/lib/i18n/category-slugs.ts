/**
 * Mapeo bidireccional entre slugs de categoría en inglés y español
 */
export const CATEGORY_SLUG_MAP = {
  // Inglés -> Español
  personality: 'personalidad',
  trivia: 'trivia',
  culture: 'cultura',
  lifestyle: 'estilo-de-vida',
} as const;

export const REVERSE_CATEGORY_SLUG_MAP = {
  // Español -> Inglés
  personalidad: 'personality',
  trivia: 'trivia',
  cultura: 'culture',
  'estilo-de-vida': 'lifestyle',
} as const;

export type EnglishCategorySlug = keyof typeof CATEGORY_SLUG_MAP;
export type SpanishCategorySlug = keyof typeof REVERSE_CATEGORY_SLUG_MAP;

/**
 * Convierte un slug de categoría al idioma objetivo
 */
export function translateCategorySlug(slug: string, targetLocale: 'en' | 'es'): string {
  if (targetLocale === 'es') {
    // Si el slug está en inglés, traducir a español
    return CATEGORY_SLUG_MAP[slug as EnglishCategorySlug] || slug;
  } else {
    // Si el slug está en español, traducir a inglés
    return REVERSE_CATEGORY_SLUG_MAP[slug as SpanishCategorySlug] || slug;
  }
}

/**
 * Obtiene el slug en inglés (canonical) desde cualquier idioma
 */
export function getCanonicalCategorySlug(slug: string): string {
  // Primero intenta encontrarlo en el reverso (español -> inglés)
  const englishSlug = REVERSE_CATEGORY_SLUG_MAP[slug as SpanishCategorySlug];
  if (englishSlug) {
    return englishSlug;
  }

  // Si no está en el reverso, asumir que ya es inglés o es un slug personalizado
  return slug;
}

/**
 * Obtiene el slug localizado para un slug inglés dado
 */
export function getLocalizedCategorySlug(slug: string, locale: 'en' | 'es'): string {
  if (locale === 'es') {
    return CATEGORY_SLUG_MAP[slug as EnglishCategorySlug] || slug;
  } else {
    // Para inglés, encontrar el equivalente español y devolver el inglés original
    // Buscar en el reverso para ver si es un slug español
    const englishEquivalent = REVERSE_CATEGORY_SLUG_MAP[slug as SpanishCategorySlug];
    return englishEquivalent || slug;
  }
}
