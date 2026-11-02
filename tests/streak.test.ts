import { describe, expect, it } from 'vitest';
import { liveStreak, todayInStreakZone } from '@/lib/quiz/streak';

describe('liveStreak', () => {
  const today = '2026-11-02';

  it('mantiene la racha si jugó hoy', () => {
    expect(liveStreak(4, today, today)).toBe(4);
  });

  it('la mantiene si jugó ayer: todavía puede estirarla hoy', () => {
    expect(liveStreak(4, '2026-11-01', today)).toBe(4);
  });

  it('la apaga cuando el último día jugado tiene hueco', () => {
    expect(liveStreak(4, '2026-10-31', today)).toBe(0);
    expect(liveStreak(9, '2025-01-01', today)).toBe(0);
  });

  it('sin fecha no hay racha', () => {
    expect(liveStreak(4, null, today)).toBe(0);
  });

  it('una fecha futura (reloj adelantado) no rompe la racha', () => {
    expect(liveStreak(4, '2026-11-05', today)).toBe(4);
  });

  it('cruza el cambio de mes y de año', () => {
    expect(liveStreak(3, '2026-10-31', '2026-11-01')).toBe(3);
    expect(liveStreak(3, '2025-12-31', '2026-01-01')).toBe(3);
  });
});

describe('todayInStreakZone', () => {
  it('devuelve el día YYYY-MM-DD en America/Santiago', () => {
    // 2026-11-02T02:30Z son las 23:30 del 1 de noviembre en Santiago (UTC-3).
    expect(todayInStreakZone(new Date('2026-11-02T02:30:00Z'))).toBe('2026-11-01');
    // 2026-11-02T04:00Z son la 01:00 del 2 de noviembre en Santiago.
    expect(todayInStreakZone(new Date('2026-11-02T04:00:00Z'))).toBe('2026-11-02');
  });
});
