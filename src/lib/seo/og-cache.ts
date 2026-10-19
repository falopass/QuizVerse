// Cache larga: el contenido OG es estable por quiz/categoría y solo cambia si se edita el quiz.
export const OG_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
} as const;
