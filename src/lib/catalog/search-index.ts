/**
 * Índice de búsqueda del explorador (`/[locale]/quiz`): el texto normalizado
 * se calcula una vez por quiz y el filtro solo hace `includes` por pulsación.
 *
 * `foldSearchText` es la misma normalización de siempre (minúsculas, sin
 * acentos, `ñ` preservada); el índice junta título, descripción, nombre de
 * categoría ya localizado y tags. Los campos se separan con `\n`, que un
 * `<input type="search">` no admite, así que una consulta nunca cruza el
 * límite entre dos campos.
 */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/n\u0303/g, '\u00f1')
    .replace(/N\u0303/g, '\u00d1')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Lo mínimo que necesita el índice; lo cumplen `ExploreCardQuiz` y `Quiz`. */
export interface SearchIndexSource {
  title: string;
  description?: string | null;
  tags?: string[];
  category?: { name?: string | null } | null;
}

export function searchIndexText(quiz: SearchIndexSource): string {
  return foldSearchText(
    [quiz.title, quiz.description ?? '', quiz.category?.name ?? '', ...(quiz.tags ?? [])].join('\n')
  );
}

export function matchesSearchIndex(indexText: string, normalizedQuery: string): boolean {
  return indexText.includes(normalizedQuery);
}

/**
 * Normaliza un término de búsqueda externo (URL `?q=` o endpoint `/api/quizzes`)
 * con la misma regla de `foldSearchText`: preserva la `ñ` precompuesta, quita
 * marcas combinantes huérfanas y devuelve `''` si el término solo contenía
 * diacríticos o espacios.
 */
export function normalizeSearchTerm(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const folded = foldSearchText(trimmed).trim();
  if (!folded) return '';
  return trimmed
    .normalize('NFD')
    .replace(/n\u0303/g, '\u00f1')
    .replace(/N\u0303/g, '\u00d1')
    .normalize('NFC');
}

/**
 * Variantes de consulta para la búsqueda remota (`/api/quizzes`): devuelve el
 * término NFC normalizado y, si lleva tildes/diéresis que `foldSearchText`
 * pliega (p. ej. `Música` → `musica`), añade también la variante plegada para
 * que la búsqueda remota mantenga paridad con el índice local.
 */
export function searchQueryTerms(value: string): string[] {
  const nfc = normalizeSearchTerm(value);
  if (!nfc) return [];
  const folded = foldSearchText(nfc);
  if (!folded || folded === nfc.toLowerCase()) {
    return [nfc];
  }
  return [nfc, folded];
}
