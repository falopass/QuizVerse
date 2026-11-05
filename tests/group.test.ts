import { describe, expect, it } from 'vitest';
import {
  GROUP_SHARE_TEXT_MAX_UNITS,
  groupPositionOf,
  groupShareText,
  isGroupToken,
  rankGroupEntries,
  type GroupEntry,
} from '@/lib/quiz/group';
import { pickProfileNickname } from '@/lib/data/group';

const entry = (over: Partial<GroupEntry> = {}): GroupEntry => ({
  nickname: 'Camila',
  score: 5,
  maxScore: 8,
  timeTakenSeconds: 60,
  gameSessionId: 'sess-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  ...over,
});

describe('isGroupToken', () => {
  it('acepta 20 hex minúsculas', () => {
    expect(isGroupToken('0123456789abcdef0123')).toBe(true);
    expect(isGroupToken('aabbccddeeff00112233')).toBe(true);
  });

  it('rechaza largo/formato distinto', () => {
    expect(isGroupToken('0123456789abcdef012')).toBe(false); // 19
    expect(isGroupToken('0123456789abcdef01234')).toBe(false); // 21
    expect(isGroupToken('0123456789ABCDEF0123')).toBe(false); // mayúsculas
    expect(isGroupToken('ghijklmnopqrstuvwx01')).toBe(false); // no hex
    expect(isGroupToken('0123456789abcdef01')).toBe(false); // share token (16)
    expect(isGroupToken('')).toBe(false);
    expect(isGroupToken(undefined)).toBe(false);
    expect(isGroupToken(1234)).toBe(false);
  });
});

describe('rankGroupEntries', () => {
  it('ordena por puntaje descendente', () => {
    const ranked = rankGroupEntries([
      entry({ nickname: 'Bajo', score: 3 }),
      entry({ nickname: 'Alto', score: 8, gameSessionId: 's2' }),
      entry({ nickname: 'Medio', score: 5, gameSessionId: 's3' }),
    ]);
    expect(ranked.map((e) => e.nickname)).toEqual(['Alto', 'Medio', 'Bajo']);
  });

  it('en empate gana el más rápido', () => {
    const ranked = rankGroupEntries([
      entry({ nickname: 'Lento', score: 8, timeTakenSeconds: 90 }),
      entry({ nickname: 'Rápido', score: 8, timeTakenSeconds: 40, gameSessionId: 's2' }),
    ]);
    expect(ranked.map((e) => e.nickname)).toEqual(['Rápido', 'Lento']);
  });

  it('en doble empate gana quien entró antes', () => {
    const ranked = rankGroupEntries([
      entry({ nickname: 'Tarde', score: 8, createdAt: '2025-01-02T00:00:00.000Z' }),
      entry({
        nickname: 'Temprano',
        score: 8,
        createdAt: '2025-01-01T00:00:00.000Z',
        gameSessionId: 's2',
      }),
    ]);
    expect(ranked.map((e) => e.nickname)).toEqual(['Temprano', 'Tarde']);
  });

  it('sin tiempo registrado queda detrás del que sí lo tiene', () => {
    const ranked = rankGroupEntries([
      entry({ nickname: 'SinTiempo', score: 8, timeTakenSeconds: null }),
      entry({ nickname: 'ConTiempo', score: 8, timeTakenSeconds: 120, gameSessionId: 's2' }),
    ]);
    expect(ranked.map((e) => e.nickname)).toEqual(['ConTiempo', 'SinTiempo']);
  });

  it('no muta la entrada', () => {
    const list = [entry({ score: 1 }), entry({ score: 9, gameSessionId: 's2' })];
    const before = [...list];
    rankGroupEntries(list);
    expect(list).toEqual(before);
  });
});

describe('groupPositionOf', () => {
  const ranked = rankGroupEntries([
    entry({ gameSessionId: 'ganador', score: 8 }),
    entry({ gameSessionId: 'segundo', score: 5 }),
    entry({ gameSessionId: 'tercero', score: 2 }),
  ]);

  it('devuelve la posición 1-based de la sesión', () => {
    expect(groupPositionOf(ranked, 'ganador')).toBe(1);
    expect(groupPositionOf(ranked, 'segundo')).toBe(2);
    expect(groupPositionOf(ranked, 'tercero')).toBe(3);
  });

  it('devuelve 0 si no está o no hay sesión', () => {
    expect(groupPositionOf(ranked, 'ajeno')).toBe(0);
    expect(groupPositionOf(ranked, undefined)).toBe(0);
    expect(groupPositionOf([], 'ganador')).toBe(0);
  });
});

describe('groupShareText', () => {
  it('título corto conserva la invitación completa', () => {
    expect(groupShareText('Saqué 7/8', 'es')).toBe('Saqué 7/8 — entra al grupo y supéranos');
    expect(groupShareText('I got 7/8', 'en')).toBe('I got 7/8 — join the group and beat us');
  });

  it('título largo: ≤220 unidades UTF-16 y la invitación intacta', () => {
    const text = groupShareText(`Saqué ${'x'.repeat(300)} en «Quiz»`, 'es');
    expect(text.length).toBeLessThanOrEqual(GROUP_SHARE_TEXT_MAX_UNITS);
    expect(text.endsWith(' — entra al grupo y supéranos')).toBe(true);
    expect(text).toContain('…');
  });

  it('un emoji en el límite no queda partido (sin sustituto suelto)', () => {
    // El emoji (2 unidades UTF-16) cae justo en el borde del recorte.
    const room = GROUP_SHARE_TEXT_MAX_UNITS - ' — entra al grupo y supéranos'.length;
    const title = `${'a'.repeat(room - 3)}😀${'b'.repeat(50)}`;
    const text = groupShareText(title, 'es');
    expect(() => encodeURIComponent(text)).not.toThrow();
    expect(text.endsWith('… — entra al grupo y supéranos')).toBe(true);
  });
});

describe('pickProfileNickname', () => {
  it('prefiere display_name sobre username', () => {
    expect(pickProfileNickname({ username: 'diego', display_name: 'Diego F' })).toBe('Diego F');
  });

  it('usa username sin display_name y recorta espacios', () => {
    expect(pickProfileNickname({ username: '  diego ', display_name: null })).toBe('diego');
    expect(pickProfileNickname({ username: 'diego', display_name: '   ' })).toBe('diego');
  });

  it('devuelve undefined sin perfil o sin nombres', () => {
    expect(pickProfileNickname(null)).toBeUndefined();
    expect(pickProfileNickname({ username: null, display_name: null })).toBeUndefined();
    expect(pickProfileNickname({ username: '  ', display_name: null })).toBeUndefined();
  });
});
