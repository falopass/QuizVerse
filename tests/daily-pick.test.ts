import { describe, expect, it } from 'vitest';
import { dailyPickCopy, dayKey, pickDailyQuiz } from '@/lib/content/daily-pick';

const makeQuizzes = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `quiz-${index}` }));

describe('dayKey', () => {
  it('formatea la fecha como YYYY-MM-DD en UTC', () => {
    expect(dayKey(new Date('2026-10-19T12:34:56Z'))).toBe('2026-10-19');
  });

  it('cruza la medianoche UTC: 23:30 y 00:30 del día siguiente dan claves distintas', () => {
    expect(dayKey(new Date('2026-10-19T23:30:00Z'))).toBe('2026-10-19');
    expect(dayKey(new Date('2026-10-20T00:30:00Z'))).toBe('2026-10-20');
  });

  it('sigue el calendario UTC aunque el instante sea de noche en Chile (UTC-3)', () => {
    // 20:30 del 19 en Chile aún es 19 en UTC; 23:30 del 19 ya es 20.
    expect(dayKey(new Date('2026-10-19T20:30:00-03:00'))).toBe('2026-10-19');
    expect(dayKey(new Date('2026-10-19T23:30:00-03:00'))).toBe('2026-10-20');
  });
});

describe('pickDailyQuiz', () => {
  it('es determinista: la misma fecha devuelve el mismo quiz en llamadas separadas', () => {
    const quizzes = makeQuizzes(24);
    const first = pickDailyQuiz(quizzes, new Date('2026-10-19T08:00:00Z'));
    const second = pickDailyQuiz(quizzes, new Date('2026-10-19T21:59:00Z'));
    expect(first?.id).toBe(second?.id);
    expect(quizzes).toContain(first);
  });

  it('rota la selección: 30 días consecutivos sobre 24 quizzes tocan al menos 5 ids', () => {
    const quizzes = makeQuizzes(24);
    const picked = new Set<string>();
    for (let day = 1; day <= 30; day += 1) {
      const pick = pickDailyQuiz(quizzes, new Date(Date.UTC(2026, 0, day)));
      if (pick) picked.add(pick.id);
    }
    expect(picked.size).toBeGreaterThanOrEqual(5);
  });

  it('devuelve null con una lista vacía', () => {
    expect(pickDailyQuiz([], new Date('2026-10-19T12:00:00Z'))).toBeNull();
  });
});

describe('dailyPickCopy', () => {
  const date = new Date('2026-10-19T12:00:00Z'); // lunes 19 de octubre de 2026

  it('localiza la fecha con día y mes en español', () => {
    const copy = dailyPickCopy('es', date);
    expect(copy.dateLabel).toContain('19');
    expect(copy.dateLabel.toLowerCase()).toContain('octubre');
    expect(copy.title).toBe('El quiz de hoy');
    expect(copy.eyebrow).toBeTruthy();
    expect(copy.body).toBeTruthy();
  });

  it('localiza la fecha con día y mes en inglés', () => {
    const copy = dailyPickCopy('en', date);
    expect(copy.dateLabel).toContain('19');
    expect(copy.dateLabel.toLowerCase()).toContain('october');
    expect(copy.title).toBe("Today's quiz");
    expect(copy.dateLabel).not.toBe(dailyPickCopy('es', date).dateLabel);
  });
});
