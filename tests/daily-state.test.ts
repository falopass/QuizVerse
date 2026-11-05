/**
 * Estado local del reto diario: «ya jugaste hoy», racha de días consecutivos
 * (incluido el cambio de horario chileno), cuenta regresiva y texto
 * compartible en emojis.
 */

import { describe, expect, it } from 'vitest';
import {
  DAILY_STORAGE_KEY,
  buildDailyShareText,
  currentDailyStreak,
  formatDailySeconds,
  nextDailyReset,
  readDailyResult,
  recordDailyResult,
  type StorageLike,
} from '@/lib/quiz/daily';
import { dayKey } from '@/lib/content/daily-pick';

function memoryStorage(initial?: Record<string, string>) {
  const data: Record<string, string> = { ...(initial ?? {}) };
  const storage: StorageLike & { data: Record<string, string> } = {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
  return storage;
}

const result = (dayKey: string, score = 4) => ({
  dayKey,
  score,
  total: 5,
  marks: [true, true, false, true, true],
  seconds: 48,
});

describe('recordDailyResult + readDailyResult («ya jugaste hoy»)', () => {
  it('guarda el resultado del día y lo devuelve intacto', () => {
    const storage = memoryStorage();
    const record = recordDailyResult(result('2026-11-05'), storage);
    expect(record.streak).toBe(1);
    expect(readDailyResult(storage)).toEqual(record);
    expect(readDailyResult(storage)?.dayKey).toBe('2026-11-05');
  });

  it('devuelve null sin nada guardado o con datos corruptos', () => {
    expect(readDailyResult(memoryStorage())).toBeNull();
    expect(readDailyResult(null)).toBeNull();
    expect(readDailyResult(memoryStorage({ [DAILY_STORAGE_KEY]: '{mal json' }))).toBeNull();
    expect(
      readDailyResult(
        memoryStorage({ [DAILY_STORAGE_KEY]: JSON.stringify({ dayKey: 'hoy', score: 'x' }) })
      )
    ).toBeNull();
  });

  it('un reintento el mismo día no infla la racha', () => {
    const storage = memoryStorage();
    recordDailyResult(result('2026-11-05'), storage);
    const again = recordDailyResult(result('2026-11-05', 5), storage);
    expect(again.streak).toBe(1);
    expect(again.score).toBe(5);
  });
});

describe('racha', () => {
  it('suma días consecutivos y se reinicia tras un hueco', () => {
    const storage = memoryStorage();
    expect(recordDailyResult(result('2026-11-05'), storage).streak).toBe(1);
    expect(recordDailyResult(result('2026-11-06'), storage).streak).toBe(2);
    expect(recordDailyResult(result('2026-11-07'), storage).streak).toBe(3);
    // Un día sin jugar y la racha vuelve a 1.
    expect(recordDailyResult(result('2026-11-09'), storage).streak).toBe(1);
  });

  it('sobrevive el cambio de horario chileno (días de 23 y 25 horas)', () => {
    const storage = memoryStorage();
    // 2026-09-06: Chile adelanta el reloj (el 5 dura 23 h). La racha usa
    // claves de calendario, así que no se rompe.
    recordDailyResult(result('2026-09-05'), storage);
    expect(recordDailyResult(result('2026-09-06'), storage).streak).toBe(2);
    recordDailyResult(result('2026-09-07'), storage);
    // 2026-04-05: Chile atrasa el reloj (el 4 dura 25 h).
    const winter = memoryStorage();
    recordDailyResult(result('2026-04-04'), winter);
    expect(recordDailyResult(result('2026-04-05'), winter).streak).toBe(2);
  });

  it('currentDailyStreak: vive hoy y ayer, muere con un día de por medio', () => {
    const storage = memoryStorage();
    recordDailyResult(result('2026-11-05'), storage);
    recordDailyResult(result('2026-11-06'), storage);
    const record = readDailyResult(storage);
    expect(currentDailyStreak(record, '2026-11-06')).toBe(2);
    expect(currentDailyStreak(record, '2026-11-07')).toBe(2);
    expect(currentDailyStreak(record, '2026-11-08')).toBe(0);
    expect(currentDailyStreak(null, '2026-11-06')).toBe(0);
  });
});

describe('nextDailyReset', () => {
  it('cae en la primera medianoche de Chile posterior a ahora', () => {
    const now = new Date('2026-11-05T20:00:00-03:00');
    const reset = nextDailyReset(now);
    expect(reset.getTime()).toBeGreaterThan(now.getTime());
    expect(dayKey(reset)).toBe('2026-11-06');
    expect(dayKey(new Date(reset.getTime() - 1000))).toBe('2026-11-05');
  });

  it('el día del cambio de horario también apunta al día siguiente', () => {
    // 2026-09-06 no tiene 00:00 local en Chile: el reloj salta a 01:00.
    const now = new Date('2026-09-06T10:00:00-03:00');
    const reset = nextDailyReset(now);
    expect(dayKey(reset)).toBe('2026-09-07');
    expect(dayKey(new Date(reset.getTime() - 1000))).toBe('2026-09-06');
    // La medianoche "saltada" sigue separando el 5 del 6 correctamente.
    const beforeSwitch = new Date('2026-09-05T22:00:00-03:00');
    const resetSwitch = nextDailyReset(beforeSwitch);
    expect(dayKey(resetSwitch)).toBe('2026-09-06');
  });
});

describe('formatDailySeconds y buildDailyShareText', () => {
  it('formatea el tiempo como m:ss', () => {
    expect(formatDailySeconds(48)).toBe('0:48');
    expect(formatDailySeconds(605)).toBe('10:05');
    expect(formatDailySeconds(0)).toBe('0:00');
  });

  it('arma el texto compartible en español sin respuestas', () => {
    const text = buildDailyShareText({
      challengeNumber: 142,
      score: 4,
      total: 5,
      marks: [true, true, false, true, true],
      seconds: 48,
      streak: 3,
      locale: 'es',
    });
    expect(text).toBe(
      'QuizVerse #142 🧠 4/5\n🟩🟩🟥🟩🟩  ⏱ 0:48  🔥 racha 3\nquizverse.org/es/daily'
    );
  });

  it('usa "streak" en inglés y apunta a /en/daily', () => {
    const text = buildDailyShareText({
      challengeNumber: 1,
      score: 0,
      total: 5,
      marks: [false, false, false, false, false],
      seconds: 9,
      streak: 1,
      locale: 'en',
    });
    expect(text).toContain('🔥 streak 1');
    expect(text).toContain('🟥🟥🟥🟥🟥');
    expect(text).toContain('quizverse.org/en/daily');
    expect(text).not.toContain('racha');
  });
});
