import { describe, expect, it } from 'vitest';
import {
  challengeCopy,
  challengeOutcome,
  challengeVerdictCopy,
  type ChallengeScore,
} from '@/lib/quiz/challenge';

const friend: ChallengeScore = { score: 6, maxScore: 8 };

describe('challengeOutcome', () => {
  it('gana con más aciertos y pierde con menos', () => {
    expect(challengeOutcome({ score: 7, maxScore: 8 }, friend)).toBe('win');
    expect(challengeOutcome({ score: 5, maxScore: 8 }, friend)).toBe('lose');
  });

  it('empata con el mismo marcador', () => {
    expect(challengeOutcome({ score: 6, maxScore: 8 }, friend)).toBe('tie');
  });

  it('no depende de maxScore para decidir', () => {
    expect(challengeOutcome({ score: 0, maxScore: 0 }, { score: 0, maxScore: 8 })).toBe('tie');
  });
});

describe('challengeCopy', () => {
  it('usa el marcador en trivia', () => {
    const es = challengeCopy(friend, 'es');
    expect(es.title).toBe('Alguien sacó 6/8');
    expect(es.eyebrow).toBe('Te retaron');

    const en = challengeCopy(friend, 'en');
    expect(en.title).toBe('A friend scored 6/8');
    expect(en.body).toContain('beat');
  });

  it('prefiere el resultado de personalidad al marcador', () => {
    const info: ChallengeScore = { score: 8, maxScore: 8, resultTitle: 'El Narrador' };
    expect(challengeCopy(info, 'es').title).toBe('Alguien sacó El Narrador');
    expect(challengeCopy(info, 'en').title).toBe('A friend scored El Narrador');
  });

  it('cae en texto genérico sin marcador', () => {
    expect(challengeCopy({ score: 0, maxScore: 0 }, 'es').title).toBe('Alguien te retó');
    expect(challengeCopy({ score: 0, maxScore: 0 }, 'en').title).toBe('A friend challenged you');
  });

  it('trata cualquier locale distinto de es como inglés', () => {
    expect(challengeCopy(friend, 'fr').eyebrow).toBe('You were challenged');
  });
});

describe('challengeVerdictCopy', () => {
  it('describe los tres desenlaces', () => {
    expect(challengeVerdictCopy('win', friend, 'es')).toBe('Superaste el reto: 6/8');
    expect(challengeVerdictCopy('tie', friend, 'es')).toBe('Empate con el reto: 6/8');
    expect(challengeVerdictCopy('lose', friend, 'es')).toBe('El reto sigue en pie: 6/8');
    expect(challengeVerdictCopy('win', friend, 'en')).toBe('You beat the challenge: 6/8');
  });

  it('usa el resultTitle cuando existe', () => {
    const info: ChallengeScore = { score: 0, maxScore: 0, resultTitle: 'El Narrador' };
    expect(challengeVerdictCopy('win', info, 'es')).toBe('Superaste el reto: El Narrador');
  });
});
