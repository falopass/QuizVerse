import { describe, expect, it } from 'vitest';
import { dailyPickCopy, dayKey, pickDailyQuiz } from '@/lib/content/daily-pick';

const makeQuizzes = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `quiz-${String(index).padStart(2, '0')}` }));

describe('dayKey', () => {
  it('usa el calendario de America/Santiago, no UTC', () => {
    // 23:30 del 19 en Chile ya es el 20 en UTC; la clave sigue siendo el 19.
    expect(dayKey(new Date('2026-10-19T23:30:00-03:00'))).toBe('2026-10-19');
    expect(dayKey(new Date('2026-10-20T00:30:00-03:00'))).toBe('2026-10-20');
    expect(dayKey(new Date('2026-10-20T02:30:00Z'))).toBe('2026-10-19');
  });

  it('cruza la medianoche de Santiago', () => {
    expect(dayKey(new Date('2026-10-19T23:59:59-03:00'))).toBe('2026-10-19');
    expect(dayKey(new Date('2026-10-20T00:00:00-03:00'))).toBe('2026-10-20');
  });

  it('mantiene días consecutivos en el cambio de hora', () => {
    // 2026-09-06 arranca el horario de verano: a las 04:00Z el reloj salta de
    // 00:00 a 01:00, así que el día anterior dura 23 horas.
    expect(dayKey(new Date('2026-09-06T03:30:00Z'))).toBe('2026-09-05');
    expect(dayKey(new Date('2026-09-06T04:30:00Z'))).toBe('2026-09-06');
  });
});

describe('pickDailyQuiz', () => {
  it('no cambia durante el día', () => {
    const quizzes = makeQuizzes(24);
    const early = pickDailyQuiz(quizzes, new Date('2026-11-02T00:01:00-03:00'));
    const late = pickDailyQuiz(quizzes, new Date('2026-11-02T23:59:00-03:00'));
    expect(early?.id).toBe(late?.id);
    expect(quizzes.some((quiz) => quiz.id === early?.id)).toBe(true);
  });

  it('no depende del orden de entrada (plays_count cambia con cada partida)', () => {
    const quizzes = makeQuizzes(24);
    const date = new Date('2026-11-02T12:00:00-03:00');
    const expected = pickDailyQuiz(quizzes, date)?.id;
    expect(pickDailyQuiz([...quizzes].reverse(), date)?.id).toBe(expected);
    expect(pickDailyQuiz([...quizzes.slice(12), ...quizzes.slice(0, 12)], date)?.id).toBe(expected);
  });

  it('cambia en días consecutivos cuando hay más de un candidato', () => {
    const quizzes = makeQuizzes(3);
    for (let day = 1; day <= 10; day += 1) {
      const today = pickDailyQuiz(quizzes, new Date(Date.UTC(2026, 10, day, 12)));
      const tomorrow = pickDailyQuiz(quizzes, new Date(Date.UTC(2026, 10, day + 1, 12)));
      expect(today?.id).not.toBe(tomorrow?.id);
    }
  });

  it('devuelve null con una lista vacía', () => {
    expect(pickDailyQuiz([], new Date('2026-11-02T12:00:00-03:00'))).toBeNull();
  });

  it('con un solo candidato devuelve ese candidato cualquier día', () => {
    const only = [{ id: 'quiz-only' }];
    expect(pickDailyQuiz(only, new Date('2026-11-02T12:00:00-03:00'))?.id).toBe('quiz-only');
    expect(pickDailyQuiz(only, new Date('2026-11-03T12:00:00-03:00'))?.id).toBe('quiz-only');
  });
});

describe('dailyPickCopy', () => {
  const date = new Date('2026-10-19T12:00:00-03:00'); // lunes 19 de octubre de 2026

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

  it('muestra el mismo día que rige la selección', () => {
    // 23:30 del 19 en Santiago: en UTC ya es 20, pero la etiqueta debe decir 19.
    const late = new Date('2026-10-20T02:30:00Z');
    expect(dayKey(late)).toBe('2026-10-19');
    expect(dailyPickCopy('es', late).dateLabel).toContain('19');
    expect(dailyPickCopy('en', late).dateLabel).toContain('19');
  });
});
