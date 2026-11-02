import { describe, expect, it } from 'vitest';
import { availableGameModes, parseInitialGameMode } from '@/lib/quiz/game-modes';

const trivia = { quiz_type: 'trivia' as const };
const personality = { quiz_type: 'personality' as const };
const poll = { quiz_type: 'poll' as const };

describe('availableGameModes', () => {
  it('la trivia ofrece los cuatro modos', () => {
    expect(availableGameModes(trivia)).toEqual(['normal', 'timed', 'survival', 'practice']);
  });

  it('personalidad y polls solo ofrecen Clásico', () => {
    expect(availableGameModes(personality)).toEqual(['normal']);
    expect(availableGameModes(poll)).toEqual(['normal']);
  });
});

describe('parseInitialGameMode', () => {
  it('sin parámetro arranca en Clásico', () => {
    expect(parseInitialGameMode(undefined, trivia)).toBe('normal');
  });

  it('acepta los nombres públicos de la URL', () => {
    expect(parseInitialGameMode('classic', trivia)).toBe('normal');
    expect(parseInitialGameMode('timed', trivia)).toBe('timed');
    expect(parseInitialGameMode('survival', trivia)).toBe('survival');
    expect(parseInitialGameMode('practice', trivia)).toBe('practice');
  });

  it('un modo desconocido cae a Clásico', () => {
    expect(parseInitialGameMode('turbo', trivia)).toBe('normal');
  });

  it('no deja que la URL salte los modos que el quiz no ofrece', () => {
    expect(parseInitialGameMode('timed', personality)).toBe('normal');
    expect(parseInitialGameMode('survival', personality)).toBe('normal');
    expect(parseInitialGameMode('practice', personality)).toBe('normal');
  });
});
