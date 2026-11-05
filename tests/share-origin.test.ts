import { beforeEach, describe, expect, it } from 'vitest';
import {
  bindRefsToChannel,
  channelForRefs,
  claimLanding,
  clearPendingOrigin,
  detectShareOrigin,
  getShareOrigin,
  landingSignatures,
  pendingShareOrigin,
  stashPendingOrigin,
  storeShareOrigin,
  stripViaParam,
} from '@/lib/share/origin';

describe('detectShareOrigin', () => {
  it('via=<canal> se detecta como llegada por share', () => {
    expect(detectShareOrigin('?via=whatsapp')).toEqual({
      kind: 'via',
      channel: 'whatsapp',
      refs: [],
    });
  });

  it('challenge y g se detectan como invitación', () => {
    expect(detectShareOrigin('?challenge=abc')).toEqual({
      kind: 'invite',
      channel: 'challenge',
      refs: ['abc'],
    });
    expect(detectShareOrigin('?g=abc')).toEqual({ kind: 'invite', channel: 'g', refs: ['abc'] });
  });

  it('via manda sobre challenge/g y conserva los tokens como refs', () => {
    expect(detectShareOrigin('?via=x&s=a&challenge=b')).toEqual({
      kind: 'via',
      channel: 'x',
      refs: ['a', 'b'],
    });
  });

  it('sin parámetros de share no hay origen', () => {
    expect(detectShareOrigin('?s=abc')).toBeNull();
    expect(detectShareOrigin('')).toBeNull();
  });
});

// El conjunto de firmas es en memoria (deduplica solo dentro del documento):
// tokens únicos por test para no depender del orden.
describe('dedupe de llegadas', () => {
  it('la navegación interna /result → /play con el mismo challenge no cuenta dos veces', () => {
    const landing = detectShareOrigin('?s=s1&challenge=c1&via=whatsapp')!;
    expect(claimLanding(landingSignatures(landing, '/es/quiz/a/result'))).toBe(false);

    const nav = detectShareOrigin('?challenge=c1')!;
    expect(claimLanding(landingSignatures(nav, '/es/quiz/a/play'))).toBe(true);
  });

  it('dos resultados distintos del mismo reto cuentan cada uno', () => {
    const first = detectShareOrigin('?s=r1&challenge=c2&via=whatsapp')!;
    const second = detectShareOrigin('?s=r2&challenge=c2&via=x')!;
    expect(claimLanding(landingSignatures(first, '/es/quiz/a/result'))).toBe(false);
    expect(claimLanding(landingSignatures(second, '/es/quiz/a/result'))).toBe(false);
  });

  it('llegadas distintas sí cuentan aunque sean del mismo canal; la repetida no', () => {
    const via = detectShareOrigin('?via=whatsapp')!;
    expect(claimLanding(landingSignatures(via, '/es/quiz/dup-a'))).toBe(false);
    expect(claimLanding(landingSignatures(via, '/es/quiz/dup-b'))).toBe(false);
    expect(claimLanding(landingSignatures(via, '/es/quiz/dup-a'))).toBe(true);
  });
});

describe('stripViaParam', () => {
  it('quita via y conserva el resto de la URL', () => {
    expect(stripViaParam('/es/quiz/messi?s=1&via=x&challenge=abc')).toBe(
      '/es/quiz/messi?s=1&challenge=abc'
    );
    expect(stripViaParam('https://quizverse.org/es/quiz/messi?via=copy#r')).toBe(
      'https://quizverse.org/es/quiz/messi#r'
    );
  });
});

describe('sessionStorage origin', () => {
  beforeEach(() => sessionStorage.clear());

  it('guarda y recupera el origen', () => {
    storeShareOrigin({ kind: 'via', channel: 'telegram' });
    expect(getShareOrigin()).toEqual({ kind: 'via', channel: 'telegram' });
  });

  it('sin origen guardado devuelve null', () => {
    expect(getShareOrigin()).toBeNull();
  });

  it('primer contacto manda: no sobreescribe un origen ya guardado', () => {
    storeShareOrigin({ kind: 'via', channel: 'whatsapp' });
    storeShareOrigin({ kind: 'invite', channel: 'challenge' });
    expect(getShareOrigin()).toEqual({ kind: 'via', channel: 'whatsapp' });
  });

  it('pendiente: cada llegada se encola hasta reportarla', () => {
    stashPendingOrigin({ kind: 'via', channel: 'x', path: '/en/quiz/a', locale: 'en' });
    expect(pendingShareOrigin()).toEqual({
      kind: 'via',
      channel: 'x',
      path: '/en/quiz/a',
      locale: 'en',
    });
    clearPendingOrigin();
    expect(pendingShareOrigin()).toBeNull();
  });

  it('pendiente y atribución son independientes: reportar no borra el origen', () => {
    storeShareOrigin({ kind: 'via', channel: 'whatsapp' });
    stashPendingOrigin({ kind: 'via', channel: 'x' });
    clearPendingOrigin();
    expect(getShareOrigin()).toEqual({ kind: 'via', channel: 'whatsapp' });
  });
});

describe('canal ligado a tokens', () => {
  beforeEach(() => sessionStorage.clear());

  it('la recarga sin via recupera el canal original por token', () => {
    bindRefsToChannel(['s1', 'c1'], 'whatsapp');
    expect(channelForRefs(['c1'])).toBe('whatsapp');
    expect(channelForRefs(['otro'])).toBeNull();
    expect(channelForRefs([])).toBeNull();
  });
});
