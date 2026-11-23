import { describe, expect, it } from 'vitest';

import { formatClock } from '@/lib/quiz/format-clock';

describe('formatClock', () => {
  it('formatea segundos a m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7)).toBe('0:07');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(3599)).toBe('59:59');
  });

  it('no acota los minutos: más de una hora sigue en m:ss', () => {
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(3661)).toBe('61:01');
  });

  it('sanea valores raros: negativos, decimales y NaN', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(NaN)).toBe('0:00');
    expect(formatClock(Infinity)).toBe('0:00');
  });
});
