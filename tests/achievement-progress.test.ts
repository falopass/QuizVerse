import { describe, expect, it } from 'vitest';
import {
  achievementProgress,
  ACHIEVEMENT_ICONS,
  HIDDEN_ACHIEVEMENT_IDS,
  pendingAchievements,
} from '@/lib/quiz/achievement-progress';

const STATS = {
  quizzes_played: 49,
  quizzes_created: 2,
  current_streak: 4,
  longest_streak: 6,
  played_categories: 3,
};

describe('achievementProgress', () => {
  it('cuenta partidas con el valor del catálogo', () => {
    expect(achievementProgress({ condition_type: 'plays', condition_value: 50 }, STATS)).toEqual({
      current: 49,
      target: 50,
      unit: 'plays',
    });
  });

  it('la racha mira el máximo histórico, igual que el SQL', () => {
    expect(achievementProgress({ condition_type: 'streak', condition_value: 7 }, STATS)).toEqual({
      current: 6,
      target: 7,
      unit: 'days',
    });
  });

  it('cuenta categorías y quizzes creados', () => {
    expect(
      achievementProgress({ condition_type: 'categories', condition_value: 5 }, STATS)
    ).toEqual({ current: 3, target: 5, unit: 'categories' });
    expect(achievementProgress({ condition_type: 'creates', condition_value: 1 }, STATS)).toEqual({
      current: 2,
      target: 1,
      unit: 'creates',
    });
  });

  it('un puntaje perfecto no tiene contador y no inventa barra', () => {
    expect(
      achievementProgress({ condition_type: 'score', condition_value: 100 }, STATS)
    ).toBeNull();
  });

  it('las métricas sin contador fiable tampoco tienen barra', () => {
    expect(
      achievementProgress({ condition_type: 'shares', condition_value: 10 }, STATS)
    ).toBeNull();
  });

  it('el objetivo nunca es 0 (evita dividir por cero)', () => {
    expect(achievementProgress({ condition_type: 'plays', condition_value: 0 }, STATS)).toEqual({
      current: 49,
      target: 1,
      unit: 'plays',
    });
  });
});

describe('pendingAchievements', () => {
  const catalog = [
    { id: 'first_quiz', condition_type: 'plays', condition_value: 1 },
    { id: 'quiz_addict_10', condition_type: 'plays', condition_value: 10 },
    { id: 'creator', condition_type: 'creates', condition_value: 3 },
    { id: 'going_viral', condition_type: 'shares', condition_value: 100 },
  ] as Parameters<typeof pendingAchievements>[0];

  it('devuelve solo los cumplidos que no están ganados', () => {
    const pending = pendingAchievements(catalog, new Set(['first_quiz']), STATS);

    expect(pending.map((item) => item.id)).toEqual(['quiz_addict_10']);
  });

  it('ignora los ocultos y los que no tienen contador', () => {
    const pending = pendingAchievements(catalog, new Set(), STATS);

    expect(pending.map((item) => item.id)).not.toContain('going_viral');
  });

  it('sin nada cumplido no devuelve nada', () => {
    const pending = pendingAchievements(catalog, new Set(['first_quiz', 'quiz_addict_10']), STATS);

    expect(pending).toEqual([]);
  });
});

describe('catálogo de la UI', () => {
  it('oculta solo los tres logros sin métrica fiable', () => {
    expect([...HIDDEN_ACHIEVEMENT_IDS].sort()).toEqual([
      'going_viral',
      'internet_famous',
      'social_butterfly',
    ]);
  });

  it('los logros alcanzables tienen icono propio (el catálogo guarda el nombre)', () => {
    for (const id of ['first_quiz', 'quiz_addict_10', 'quiz_master_50', 'perfect_score']) {
      expect(ACHIEVEMENT_ICONS[id]).toBeTruthy();
    }
    for (const id of ['creator', 'week_streak', 'explorer']) {
      expect(ACHIEVEMENT_ICONS[id]).toBeTruthy();
    }
  });
});
