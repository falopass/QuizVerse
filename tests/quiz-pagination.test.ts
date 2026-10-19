import { describe, expect, it } from 'vitest';
import { isLastPage, pageRanges, QUIZ_MAX_ROWS, QUIZ_PAGE_SIZE } from '@/lib/data/quiz-pagination';

function collectRows(totalRows: number, pageSize: number, maxRows: number): number {
  let collected = 0;
  for (const { from, to } of pageRanges(pageSize, maxRows)) {
    const received = Math.max(0, Math.min(to, totalRows - 1) - from + 1);
    collected += received;
    if (isLastPage(received, to - from + 1)) {
      break;
    }
  }
  return collected;
}

describe('pageRanges', () => {
  it('covers an exact multiple of the page size without gaps or overlaps', () => {
    const ranges = pageRanges(500, 1000);
    expect(ranges).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 999 },
    ]);
  });

  it('truncates the last page to maxRows instead of overflowing', () => {
    expect(pageRanges(500, 600)).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 599 },
    ]);
  });

  it('resolves a small limit in a single page', () => {
    expect(pageRanges(Math.min(QUIZ_PAGE_SIZE, 24), 24)).toEqual([{ from: 0, to: 23 }]);
  });

  it('emits no ranges when maxRows is zero or negative', () => {
    expect(pageRanges(500, 0)).toEqual([]);
    expect(pageRanges(500, -10)).toEqual([]);
  });

  it('caps the row budget at the guard', () => {
    const ranges = pageRanges(QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS);
    expect(ranges).toHaveLength(20);
    expect(ranges.at(-1)).toEqual({ from: 9500, to: 9999 });
  });

  it('rejects a non-positive page size', () => {
    expect(() => pageRanges(0, 100)).toThrow();
    expect(() => pageRanges(-5, 100)).toThrow();
  });
});

describe('isLastPage', () => {
  it('stops when the page comes back short', () => {
    expect(isLastPage(24, 500)).toBe(true);
    expect(isLastPage(0, 500)).toBe(true);
  });

  it('continues when the page is full', () => {
    expect(isLastPage(500, 500)).toBe(false);
  });
});

describe('paginated fetch loop', () => {
  it('walks the whole catalog across exact pages', () => {
    expect(collectRows(QUIZ_PAGE_SIZE * 3, QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS)).toBe(QUIZ_PAGE_SIZE * 3);
  });

  it('stops as soon as a page comes back short', () => {
    expect(collectRows(524, QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS)).toBe(524);
  });

  it('never exceeds the guard even when the table keeps answering full pages', () => {
    expect(collectRows(Number.MAX_SAFE_INTEGER, QUIZ_PAGE_SIZE, QUIZ_MAX_ROWS)).toBe(QUIZ_MAX_ROWS);
  });

  it('returns every row a small limit asks for without extra pages', () => {
    expect(collectRows(24, 24, 24)).toBe(24);
  });
});
