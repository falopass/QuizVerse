/**
 * Reto diario: selección determinista del quiz de trivia y de sus cinco
 * preguntas, numeración del reto y aritmética de claves de día.
 */

import { describe, expect, it } from 'vitest';
import {
  DAILY_LAUNCH_DAY_KEY,
  DAILY_QUESTION_COUNT,
  dailyChallengeNumber,
  dateFromDayKey,
  dayKey,
  dayKeyAdd,
  pickDailyQuestions,
  pickDailyTriviaQuiz,
} from '@/lib/content/daily-pick';

const trivia = (id: string, questionCount: number) => ({
  id,
  quiz_type: 'trivia',
  questions: Array.from({ length: questionCount }, (_, index) => ({
    id: `${id}-q${index}`,
  })),
});

const personality = (id: string, questionCount = 8) => ({
  id,
  quiz_type: 'personality',
  questions: Array.from({ length: questionCount }, (_, index) => ({
    id: `${id}-q${index}`,
  })),
});

const DATE = new Date('2026-11-10T12:00:00-03:00');

describe('pickDailyTriviaQuiz', () => {
  it('ignora los quizzes que no son trivia', () => {
    const quizzes = [personality('p-1'), personality('p-2'), personality('p-3')];
    expect(pickDailyTriviaQuiz(quizzes, DATE)).toBeNull();
  });

  it('es determinista y no depende del orden de entrada', () => {
    const quizzes = [trivia('a', 5), trivia('b', 10), personality('c'), trivia('d', 8)];
    const pick = pickDailyTriviaQuiz(quizzes, DATE);
    expect(pick).not.toBeNull();
    expect(pick?.quiz_type).toBe('trivia');
    expect(pickDailyTriviaQuiz([...quizzes].reverse(), DATE)?.id).toBe(pick?.id);
    // Misma hora del día, cualquier instante vale.
    expect(pickDailyTriviaQuiz(quizzes, new Date('2026-11-10T23:59:00-03:00'))?.id).toBe(pick?.id);
  });

  it('rota en días consecutivos cuando hay varios candidatos', () => {
    const quizzes = [trivia('a', 5), trivia('b', 5), trivia('c', 5)];
    for (let day = 1; day <= 9; day += 1) {
      const today = pickDailyTriviaQuiz(quizzes, new Date(Date.UTC(2026, 10, day, 12)));
      const tomorrow = pickDailyTriviaQuiz(quizzes, new Date(Date.UTC(2026, 10, day + 1, 12)));
      expect(today?.id).not.toBe(tomorrow?.id);
    }
  });

  it('prefiere quizzes con suficientes preguntas para el reto', () => {
    const short = trivia('short', 3);
    const full = trivia('full', 8);
    for (let day = 1; day <= 15; day += 1) {
      const pick = pickDailyTriviaQuiz([short, full], new Date(Date.UTC(2026, 10, day, 12)));
      expect(pick?.id).toBe('full');
    }
  });

  it('cae a trivia corta cuando ninguna llega a cinco preguntas', () => {
    const quizzes = [trivia('a', 2), trivia('b', 4)];
    const pick = pickDailyTriviaQuiz(quizzes, DATE);
    expect(pick).not.toBeNull();
    expect(pick?.questions.length).toBeLessThan(DAILY_QUESTION_COUNT);
  });
});

describe('pickDailyQuestions', () => {
  const questions = Array.from({ length: 12 }, (_, index) => ({ id: `q${index}` }));

  it('devuelve todas cuando no sobran', () => {
    const few = questions.slice(0, 3);
    expect(pickDailyQuestions(few, DATE)).toEqual(few);
    expect(pickDailyQuestions(few, new Date('2026-11-11T12:00:00-03:00'))).toEqual(few);
  });

  it('elige cinco distintas, en el orden original del quiz', () => {
    const picked = pickDailyQuestions(questions, DATE);
    expect(picked).toHaveLength(DAILY_QUESTION_COUNT);
    expect(new Set(picked.map((question) => question.id)).size).toBe(DAILY_QUESTION_COUNT);
    const indexes = picked.map((question) => questions.indexOf(question));
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it('mismo día mismas preguntas, otro día otro subconjunto', () => {
    const ids = (date: Date) =>
      pickDailyQuestions(questions, date)
        .map((q) => q.id)
        .join(',');
    const a = ids(new Date('2026-11-10T08:00:00-03:00'));
    expect(ids(new Date('2026-11-10T22:00:00-03:00'))).toBe(a);

    const seen = new Set<string>();
    for (let day = 1; day <= 12; day += 1) {
      seen.add(ids(new Date(Date.UTC(2026, 10, day, 12))));
    }
    // Con 12 preguntas y selección por hash, doce días no pueden repetir todos.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('dailyChallengeNumber', () => {
  it('numera desde el día de lanzamiento', () => {
    expect(dailyChallengeNumber(dateFromDayKey(DAILY_LAUNCH_DAY_KEY))).toBe(1);
    expect(dailyChallengeNumber(dateFromDayKey('2026-11-06'))).toBe(2);
    expect(dailyChallengeNumber(dateFromDayKey('2026-12-05'))).toBe(31);
  });

  it('nunca baja de 1 aunque la fecha sea anterior al lanzamiento', () => {
    expect(dailyChallengeNumber(dateFromDayKey('2026-01-01'))).toBe(1);
  });
});

describe('dayKeyAdd y dateFromDayKey', () => {
  it('suma y resta días civiles cruzando meses', () => {
    expect(dayKeyAdd('2026-11-05', 1)).toBe('2026-11-06');
    expect(dayKeyAdd('2026-11-05', -1)).toBe('2026-11-04');
    expect(dayKeyAdd('2026-11-01', -1)).toBe('2026-10-31');
    expect(dayKeyAdd('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('dateFromDayKey aterriza en el mismo día civil en Chile todo el año', () => {
    for (const key of ['2026-01-15', '2026-04-05', '2026-09-06', '2026-11-05']) {
      expect(dayKey(dateFromDayKey(key))).toBe(key);
    }
  });
});
