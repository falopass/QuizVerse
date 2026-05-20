import { describe, it, expect } from 'vitest';
import {
  calculateTriviaScore,
  calculatePersonalityScore,
  calculatePoints,
  checkAchievements,
} from '@/lib/quiz/scoring';
import type { Question, PersonalityResult } from '@/types/quiz';

describe('calculateTriviaScore', () => {
  const baseQuestions: Question[] = [
    {
      id: 'q1',
      question: 'Q1',
      options: [
        { id: 'o1', text: 'A', is_correct: true },
        { id: 'o2', text: 'B', is_correct: false },
      ],
    },
    {
      id: 'q2',
      question: 'Q2',
      options: [
        { id: 'o3', text: 'C', is_correct: false },
        { id: 'o4', text: 'D', is_correct: true },
      ],
    },
  ];

  it('debería calcular puntaje perfecto', () => {
    const answers = [
      { question_id: 'q1', selected_option_id: 'o1', is_correct: true, time_ms: 5000 },
      { question_id: 'q2', selected_option_id: 'o4', is_correct: true, time_ms: 5000 },
    ];
    const result = calculateTriviaScore(baseQuestions, answers);
    expect(result.percentage).toBe(100);
    expect(result.correctCount).toBe(2);
    expect(result.score).toBeGreaterThan(0);
  });

  it('debería calcular puntaje parcial', () => {
    const answers = [
      { question_id: 'q1', selected_option_id: 'o1', is_correct: true, time_ms: 5000 },
      { question_id: 'q2', selected_option_id: 'o3', is_correct: false, time_ms: 5000 },
    ];
    const result = calculateTriviaScore(baseQuestions, answers);
    expect(result.percentage).toBe(50);
    expect(result.correctCount).toBe(1);
  });

  it('debería manejar sin respuestas', () => {
    const result = calculateTriviaScore(baseQuestions, []);
    expect(result.percentage).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.score).toBe(0);
  });

  it('debería otorgar speed bonus', () => {
    const answers = [
      { question_id: 'q1', selected_option_id: 'o1', is_correct: true, time_ms: 5000 },
      { question_id: 'q2', selected_option_id: 'o4', is_correct: true, time_ms: 5000 },
    ];
    const result = calculateTriviaScore(baseQuestions, answers);
    expect(result.speedBonus).toBeGreaterThan(0);
  });
});

describe('calculatePersonalityScore', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      question: 'Q1',
      options: [
        { id: 'o1', text: 'A', personality_tags: ['introvert'] },
        { id: 'o2', text: 'B', personality_tags: ['extrovert'] },
      ],
    },
    {
      id: 'q2',
      question: 'Q2',
      options: [
        { id: 'o3', text: 'C', personality_tags: ['introvert'] },
        { id: 'o4', text: 'D', personality_tags: ['extrovert'] },
      ],
    },
  ];

  const results: PersonalityResult[] = [
    {
      id: 'r1',
      title: 'Introvert',
      description: 'You are introverted',
      personality_tag: 'introvert',
    },
    {
      id: 'r2',
      title: 'Extrovert',
      description: 'You are extroverted',
      personality_tag: 'extrovert',
    },
  ];

  it('debería detectar tag dominante', () => {
    const answers = [{ selected_option_id: 'o1' }, { selected_option_id: 'o3' }];
    const result = calculatePersonalityScore(questions, answers, results);
    expect(result.dominantTag).toBe('introvert');
    expect(result.result?.title).toBe('Introvert');
  });

  it('debería manejar empate', () => {
    const answers = [{ selected_option_id: 'o1' }, { selected_option_id: 'o4' }];
    const result = calculatePersonalityScore(questions, answers, results);
    expect(result.tagDistribution['introvert']).toBe(1);
    expect(result.tagDistribution['extrovert']).toBe(1);
  });

  it('debería retornar null sin resultados definidos', () => {
    const answers = [{ selected_option_id: 'o1' }];
    const result = calculatePersonalityScore(questions, answers, []);
    expect(result.result).toBeNull();
    expect(result.dominantTag).toBe('introvert');
  });
});

describe('calculatePoints', () => {
  it('debería retornar puntos base', () => {
    const trivialResult = {
      score: 20,
      maxScore: 40,
      percentage: 100,
      correctCount: 2,
      streakBonus: 0,
      speedBonus: 0,
    };
    const result = calculatePoints(trivialResult, true);
    expect(result.totalPoints).toBe(35);
    expect(result.basePoints).toBe(10);
    expect(result.bonusPoints).toBe(25);
  });

  it('debería otorgar bonus por desempeño >80%', () => {
    const trivialResult = {
      score: 10,
      maxScore: 40,
      percentage: 80,
      correctCount: 1,
      streakBonus: 0,
      speedBonus: 0,
    };
    const result = calculatePoints(trivialResult, false);
    expect(result.bonusPoints).toBe(10);
    expect(result.totalPoints).toBe(20);
  });
});

describe('checkAchievements', () => {
  it('debería detectar primer quiz', () => {
    const result = checkAchievements(
      { percentage: 50, score: 10, isPerfectScore: false },
      { quizzesPlayed: 1, categoriesPlayed: new Set(['c1']) }
    );
    expect(result.some((a) => a.achievementId === 'first_quiz' && a.unlocked)).toBe(true);
  });

  it('debería detectar puntaje perfecto', () => {
    const result = checkAchievements(
      { percentage: 100, score: 20, isPerfectScore: true },
      { quizzesPlayed: 5, categoriesPlayed: new Set(['c1']) }
    );
    expect(result.some((a) => a.achievementId === 'perfect_score' && a.unlocked)).toBe(true);
  });

  it('debería detectar explorador (5 categorías)', () => {
    const result = checkAchievements(
      { percentage: 80, score: 15, isPerfectScore: false },
      { quizzesPlayed: 15, categoriesPlayed: new Set(['c1', 'c2', 'c3', 'c4', 'c5']) }
    );
    expect(result.some((a) => a.achievementId === 'explorer' && a.unlocked)).toBe(true);
  });
});
