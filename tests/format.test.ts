import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCompactNumber, formatNumber, formatRelativeDate } from '@/lib/utils/format';

describe('formatNumber', () => {
  it.each([0, 1, 999, 1234, 1234567.89])('formats %i like Intl en-US', (n) => {
    expect(formatNumber(n, 'en')).toBe(new Intl.NumberFormat('en-US').format(n));
    expect(formatNumber(n, 'es')).toBe(new Intl.NumberFormat('es').format(n));
  });

  it("defaults to 'en'", () => {
    expect(formatNumber(1234)).toBe(formatNumber(1234, 'en'));
  });
});

describe('formatCompactNumber', () => {
  const compact = (locale: string) =>
    new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    });

  it.each([0, 42, 999, 1200, 1500000])('formats %i like Intl compact', (n) => {
    expect(formatCompactNumber(n, 'en')).toBe(compact('en-US').format(n));
    expect(formatCompactNumber(n, 'es')).toBe(compact('es').format(n));
  });

  it('returns "0" for 0', () => {
    expect(formatCompactNumber(0)).toBe('0');
  });
});

describe('formatRelativeDate', () => {
  // Freeze the clock so boundary assertions can't race a real second tick.
  const NOW = new Date('2026-10-19T12:00:00.000Z');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);

  it('en: just now for < 60s', () => {
    expect(formatRelativeDate(secondsAgo(0), 'en')).toBe('just now');
    expect(formatRelativeDate(secondsAgo(59), 'en')).toBe('just now');
  });

  it('en: minutes', () => {
    expect(formatRelativeDate(secondsAgo(60), 'en')).toBe('1 min ago');
    expect(formatRelativeDate(secondsAgo(3599), 'en')).toBe('59 min ago');
  });

  it('en: singular and plural hours', () => {
    expect(formatRelativeDate(secondsAgo(3600), 'en')).toBe('1 hour ago');
    expect(formatRelativeDate(secondsAgo(7200), 'en')).toBe('2 hours ago');
    expect(formatRelativeDate(secondsAgo(3600), 'en')).not.toBe('1 hours ago');
  });

  it('en: singular and plural days', () => {
    expect(formatRelativeDate(secondsAgo(86400), 'en')).toBe('1 day ago');
    expect(formatRelativeDate(secondsAgo(172800), 'en')).toBe('2 days ago');
    expect(formatRelativeDate(secondsAgo(86400), 'en')).not.toBe('1 days ago');
  });

  it('en: absolute date for >= 7 days', () => {
    const then = secondsAgo(8 * 86400);
    expect(formatRelativeDate(then, 'en')).toBe(
      then.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    );
  });

  it('en: future date falls back to absolute date', () => {
    const future = new Date(NOW.getTime() + 3600_000);
    expect(formatRelativeDate(future, 'en')).toBe(
      future.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    );
  });

  it('es: ahora mismo for < 60s', () => {
    expect(formatRelativeDate(secondsAgo(0), 'es')).toBe('ahora mismo');
    expect(formatRelativeDate(secondsAgo(59), 'es')).toBe('ahora mismo');
  });

  it('es: minutos, horas y días', () => {
    expect(formatRelativeDate(secondsAgo(60), 'es')).toBe('hace 1 min');
    expect(formatRelativeDate(secondsAgo(3600), 'es')).toBe('hace 1 hora');
    expect(formatRelativeDate(secondsAgo(7200), 'es')).toBe('hace 2 horas');
    expect(formatRelativeDate(secondsAgo(86400), 'es')).toBe('hace 1 día');
    expect(formatRelativeDate(secondsAgo(172800), 'es')).toBe('hace 2 días');
  });

  it('es: future date falls back to absolute date', () => {
    const future = new Date(NOW.getTime() + 3600_000);
    expect(formatRelativeDate(future, 'es')).toBe(
      future.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    );
  });
});
