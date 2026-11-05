import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingOrigin,
  detectShareOrigin,
  getShareOrigin,
  landingSignature,
  markLandingSeen,
  pendingShareOrigin,
  stashPendingOrigin,
  storeShareOrigin,
  stripViaParam,
} from '@/lib/share/origin';

describe('detectShareOrigin', () => {
  it('via=<canal> se detecta como llegada por share', () => {
    expect(detectShareOrigin('?via=whatsapp')).toEqual({ kind: 'via', channel: 'whatsapp' });
  });

  it('challenge y g se detectan como invitación', () => {
    expect(detectShareOrigin('?challenge=abc')).toEqual({
      kind: 'invite',
      channel: 'challenge',
      ref: 'abc',
    });
    expect(detectShareOrigin('?g=abc')).toEqual({ kind: 'invite', channel: 'g', ref: 'abc' });
  });

  it('via manda sobre challenge/g y conserva el token como ref', () => {
    expect(detectShareOrigin('?via=x&challenge=abc')).toEqual({
      kind: 'via',
      channel: 'x',
      ref: 'abc',
    });
  });

  it('sin parámetros de share no hay origen', () => {
    expect(detectShareOrigin('?s=abc')).toBeNull();
    expect(detectShareOrigin('')).toBeNull();
  });
});

describe('dedupe de llegadas', () => {
  beforeEach(() => sessionStorage.clear());

  it('la navegación interna /result → /play con el mismo challenge no cuenta dos veces', () => {
    const landing = detectShareOrigin('?s=t&challenge=t&via=whatsapp')!;
    const sig1 = landingSignature(landing, '/es/quiz/a/result');
    expect(markLandingSeen(sig1)).toBe(false);

    const nav = detectShareOrigin('?challenge=t')!;
    const sig2 = landingSignature(nav, '/es/quiz/a/play');
    expect(markLandingSeen(sig2)).toBe(true); // mismo token: no es una llegada nueva
  });

  it('llegadas distintas sí cuentan aunque sean del mismo canal', () => {
    expect(
      markLandingSeen(landingSignature(detectShareOrigin('?via=whatsapp')!, '/es/quiz/a'))
    ).toBe(false);
    expect(
      markLandingSeen(landingSignature(detectShareOrigin('?via=whatsapp')!, '/es/quiz/b'))
    ).toBe(false);
    // La misma repetida no.
    expect(
      markLandingSeen(landingSignature(detectShareOrigin('?via=whatsapp')!, '/es/quiz/a'))
    ).toBe(true);
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
