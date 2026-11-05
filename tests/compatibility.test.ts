import { describe, expect, it } from 'vitest';
import {
  compatibilityLabel,
  compatibilityVerdict,
  personalityTagsFromAnswers,
  samePersonalityResult,
} from '@/lib/quiz/compatibility';

const questions = [
  {
    id: 'q1',
    options: [
      { id: 'q1a', text: 'A', personality_tags: ['hero'] },
      { id: 'q1b', text: 'B', personality_tags: ['rival', 'dark'] },
    ],
  },
  {
    id: 'q2',
    options: [
      { id: 'q2a', text: 'A', personality_tags: ['hero'] },
      { id: 'q2b', text: 'B' },
    ],
  },
];

describe('personalityTagsFromAnswers', () => {
  it('suma los tags de la opción elegida en cada pregunta', () => {
    const tags = personalityTagsFromAnswers(questions, [
      { question_id: 'q1', selected_option_id: 'q1b' },
      { question_id: 'q2', selected_option_id: 'q2a' },
    ]);

    expect(tags).toEqual(['rival', 'dark', 'hero']);
  });

  it('ignora preguntas ajenas, respuestas omitidas y opciones sin tags', () => {
    const tags = personalityTagsFromAnswers(questions, [
      { question_id: 'qX', selected_option_id: 'q1a' },
      { question_id: 'q1', selected_option_id: '' },
      { question_id: 'q2', selected_option_id: 'q2b' },
    ]);

    expect(tags).toEqual([]);
  });
});

describe('samePersonalityResult', () => {
  it('compara por result_id cuando ambos lo tienen', () => {
    expect(
      samePersonalityResult(
        { resultId: 'r1', resultTitle: 'Hero' },
        { resultId: 'r1', resultTitle: 'Otro título' }
      )
    ).toBe(true);
    expect(samePersonalityResult({ resultId: 'r1' }, { resultId: 'r2', resultTitle: 'Hero' })).toBe(
      false
    );
  });

  it('cae al título cuando falta algún result_id', () => {
    expect(samePersonalityResult({ resultTitle: 'Hero' }, { resultTitle: 'Hero' })).toBe(true);
    expect(
      samePersonalityResult({ resultId: 'r1', resultTitle: 'Hero' }, { resultTitle: 'Hero' })
    ).toBe(true);
    expect(samePersonalityResult({ resultTitle: 'Hero' }, { resultTitle: 'Rival' })).toBe(false);
    expect(samePersonalityResult({}, { resultTitle: 'Hero' })).toBe(false);
  });
});

describe('compatibilityVerdict', () => {
  it('devuelve 100 con vectores idénticos', () => {
    const tags = ['hero', 'hero', 'rival'];

    expect(compatibilityVerdict(tags, tags, false)).toEqual({
      percent: 100,
      tier: 'soulmates',
    });
  });

  it('es simétrico: los dos jugadores ven el mismo número', () => {
    const a = ['hero', 'hero', 'rival'];
    const b = ['rival', 'rival', 'hero', 'dark'];

    expect(compatibilityVerdict(a, b, false)).toEqual(compatibilityVerdict(b, a, false));
  });

  it('es determinista', () => {
    const a = ['hero', 'rival'];
    const b = ['rival', 'dark'];

    expect(compatibilityVerdict(a, b, false)).toEqual(compatibilityVerdict(a, b, false));
  });

  it('sin tags en común da 0 y rivales eternos', () => {
    expect(compatibilityVerdict(['hero'], ['rival'], false)).toEqual({
      percent: 0,
      tier: 'rivals',
    });
  });

  it('clasifica los rangos intermedios', () => {
    // vectores con solape parcial: coseno 0.8 → buen equipo
    expect(compatibilityVerdict(['a', 'a', 'b'], ['a', 'b', 'b'], false)?.tier).toBe('team');
    // solape bajo: coseno 0.5 → polos opuestos que se atraen
    expect(compatibilityVerdict(['a', 'b'], ['a', 'c'], false)?.tier).toBe('opposites');
  });

  it('mismo resultado garantiza afinidad alta', () => {
    const verdict = compatibilityVerdict(['hero', 'rival'], ['rival', 'dark'], true);

    expect(verdict?.percent).toBeGreaterThanOrEqual(85);
    expect(verdict?.tier).toBe('soulmates');
  });

  it('sin tags en alguna partida no hay veredicto', () => {
    expect(compatibilityVerdict([], ['hero'], false)).toBeNull();
    expect(compatibilityVerdict(['hero'], [], true)).toBeNull();
    expect(compatibilityVerdict([], [], false)).toBeNull();
  });
});

describe('compatibilityLabel', () => {
  it('nombra cada rango en español', () => {
    expect(compatibilityLabel('soulmates', 'es')).toBe('Almas gemelas');
    expect(compatibilityLabel('team', 'es')).toBe('Buen equipo');
    expect(compatibilityLabel('opposites', 'es')).toBe('Polos opuestos que se atraen');
    expect(compatibilityLabel('rivals', 'es')).toBe('Rivales eternos');
  });

  it('nombra cada rango en inglés', () => {
    expect(compatibilityLabel('soulmates', 'en')).toBe('Soulmates');
    expect(compatibilityLabel('team', 'en')).toBe('Great team');
    expect(compatibilityLabel('opposites', 'en')).toBe('Opposites attract');
    expect(compatibilityLabel('rivals', 'en')).toBe('Eternal rivals');
  });
});
