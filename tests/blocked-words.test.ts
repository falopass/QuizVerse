/**
 * Cobertura directa del módulo `src/lib/moderation/blocked-words.ts` (D-14)
 * usando invariantes estructurales y fixtures inocuos.
 */

import { describe, expect, it } from 'vitest';
import {
  BLOCKED_WORDS,
  EXCEPTION_WORDS,
  RESERVED_WORDS,
  type BlockedMatch,
} from '@/lib/moderation/blocked-words';
import { isNicknameAllowed, isNicknameReserved } from '@/lib/moderation/nickname';

const LOWERCASE_ASCII = /^[a-z]+$/;
const VALID_MATCHES = new Set<BlockedMatch>(['contains', 'exact', 'boundary']);

describe('blocked-words.ts — invariantes del catálogo de moderación', () => {
  it('mantiene listas no vacías y formas plegadas válidas (solo a-z sin tildes ni leet)', () => {
    expect(BLOCKED_WORDS.length).toBeGreaterThan(0);
    expect(RESERVED_WORDS.length).toBeGreaterThan(0);
    expect(EXCEPTION_WORDS.length).toBeGreaterThan(0);

    for (const entry of [...BLOCKED_WORDS, ...RESERVED_WORDS]) {
      expect(entry.term).toMatch(LOWERCASE_ASCII);
      if (entry.match !== undefined) {
        expect(VALID_MATCHES.has(entry.match)).toBe(true);
      }
      if (entry.allowBefore !== undefined) {
        expect(entry.match).toBe('boundary');
        expect(entry.allowBefore).toMatch(LOWERCASE_ASCII);
      }
    }

    for (const exception of EXCEPTION_WORDS) {
      expect(exception).toMatch(LOWERCASE_ASCII);
    }
  });

  it('no contiene duplicados internos ni solapamientos entre BLOCKED_WORDS y RESERVED_WORDS', () => {
    const blockedKeys = BLOCKED_WORDS.map((item) => `${item.term}:${item.match ?? 'contains'}`);
    expect(new Set(blockedKeys).size).toBe(blockedKeys.length);

    const reservedKeys = RESERVED_WORDS.map((item) => `${item.term}:${item.match ?? 'contains'}`);
    expect(new Set(reservedKeys).size).toBe(reservedKeys.length);

    const exceptionSet = new Set(EXCEPTION_WORDS);
    expect(exceptionSet.size).toBe(EXCEPTION_WORDS.length);

    const blockedTerms = new Set(BLOCKED_WORDS.map((item) => item.term));
    const overlap = RESERVED_WORDS.filter((item) => blockedTerms.has(item.term));
    expect(overlap).toEqual([]);
  });

  it('todas las palabras de EXCEPTION_WORDS pasan el filtro de apodos sin falso positivo', () => {
    for (const word of EXCEPTION_WORDS) {
      const verdict = isNicknameAllowed(word);
      expect(verdict, `excepción "${word}" debería permitirse`).toEqual({ ok: true, value: word });
    }
  });
});

describe('blocked-words.ts — fixtures inocuos de reglas exact, boundary y reserved', () => {
  it('permite palabras cotidianas con prefijos válidos en reglas boundary y subcadenas en exact', () => {
    const innocuous = [
      'Computadora',
      'Analía',
      'análisis',
      'canal',
      'artículo',
      'película',
      'oráculo',
      'peculiar',
      'oculista',
      'escoger',
      'conocer',
      'cumpleaños',
      'document',
      'class',
      'Essex',
      'Pascal',
      'Scunthorpe',
      'Hancock',
      'supportive',
      'supporter',
    ];

    for (const fixture of innocuous) {
      expect(isNicknameAllowed(fixture), `fixture inocuo "${fixture}"`).toEqual({
        ok: true,
        value: fixture,
      });
    }
  });

  it('reserva nombres de staff/marca sin bloquear palabras inocuas que contienen raíces exact', () => {
    for (const staffName of ['admin', 'moderator', 'moderador', 'quizverse', 'soporte', 'staff']) {
      expect(isNicknameReserved(staffName)).toBe(true);
      expect(isNicknameAllowed(staffName)).toEqual({ ok: false, reason: 'reserved' });
    }

    for (const innocent of [
      'Moda',
      'Stafford',
      'botella',
      'información',
      'ayudante',
      'sistemas24',
    ]) {
      expect(isNicknameReserved(innocent)).toBe(false);
      expect(isNicknameAllowed(innocent)).toEqual({ ok: true, value: innocent });
    }
  });
});
