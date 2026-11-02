export const QUIZ_PAGE_SIZE = 500;
export const QUIZ_MAX_ROWS = 10_000;
/** Tarjetas por página en los hubs de categoría (`?page=N`). */
export const CATEGORY_PAGE_SIZE = 36;

/**
 * Lee el `?page=N` de un hub de categoría. Sin parámetro es la página 1; una
 * página 1 explícita también, para que su canonical sea la URL sin query.
 * Devuelve null cuando el valor no es un entero positivo: esas URLs no son
 * una segunda dirección de la página 1, hacen 404.
 */
export function parsePageParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 1;
  if (!/^\d+$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export interface PageRange {
  from: number;
  to: number;
}

export function pageRanges(pageSize: number, maxRows: number): PageRange[] {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`pageSize must be a positive integer, got ${pageSize}`);
  }
  const ranges: PageRange[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    ranges.push({ from, to: Math.min(from + pageSize, maxRows) - 1 });
  }
  return ranges;
}

export function isLastPage(received: number, requested: number): boolean {
  return received < requested;
}
