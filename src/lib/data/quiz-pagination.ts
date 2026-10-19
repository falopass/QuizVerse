export const QUIZ_PAGE_SIZE = 500;
export const QUIZ_MAX_ROWS = 10_000;

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
