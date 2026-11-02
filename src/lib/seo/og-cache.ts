// Cache larga: el contenido OG es estable por quiz/categoría y solo cambia si se edita el quiz.
export const OG_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
} as const;

// Cache corta para respuestas de respaldo (slug inexistente o conteo en cero):
// si el contenido aparece después, el CDN no sirve la tarjeta genérica por un día.
export const OG_MISS_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
} as const;
