import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { CONSENT_KEY } from '@/components/shared/cookie-consent';
import { AdSlot } from '@/components/shared/ad-slot';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  readonly callback: ObserverCallback;
  disconnected = false;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

function grantConsent(level: 'all' | 'essential') {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ level, version: 2, timestamp: Date.now() }));
}

function setAdsEnv(
  publisher: string | undefined = 'ca-pub-123456',
  slot: string | undefined = '987654'
) {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', publisher);
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_HOME_SLOT', slot);
}

function adScript() {
  return document.querySelector<HTMLScriptElement>('script[data-quizverse-adsense]');
}

beforeEach(() => {
  localStorage.clear();
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  document.head
    .querySelectorAll('script[data-quizverse-adsense]')
    .forEach((script) => script.remove());
  delete window.adsbygoogle;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('AdSlot', () => {
  it('no renderiza nada sin publisher ID ni slot', () => {
    setAdsEnv('', '');
    grantConsent('all');

    const { container } = render(<AdSlot placement="home" locale="es" />);

    expect(container).toBeEmptyDOMElement();
    expect(adScript()).toBeNull();
  });

  it('no renderiza nada si falta el slot de esa ubicación', () => {
    setAdsEnv('ca-pub-123456', '');
    grantConsent('all');

    const { container } = render(<AdSlot placement="home" locale="es" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('reserva altura y etiqueta pero no carga el script sin consentimiento', () => {
    setAdsEnv();

    const { container } = render(<AdSlot placement="home" locale="es" />);

    expect(screen.getByText('Publicidad')).toBeInTheDocument();
    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins).toHaveStyle({ height: '100px' });
    expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-123456');
    expect(ins).toHaveAttribute('data-ad-slot', '987654');
    expect(adScript()).toBeNull();
    expect(window.adsbygoogle).toBeUndefined();
  });

  it('solo esenciales tampoco carga el script', () => {
    setAdsEnv();
    grantConsent('essential');

    render(<AdSlot placement="home" locale="en" />);

    expect(observers).toHaveLength(0);
    expect(adScript()).toBeNull();
  });

  it('con consentimiento carga diferido al acercarse al viewport', () => {
    setAdsEnv();
    grantConsent('all');

    render(<AdSlot placement="home" locale="en" />);

    expect(screen.getByText('Advertisement')).toBeInTheDocument();
    expect(observers).toHaveLength(1);
    expect(adScript()).toBeNull();

    act(() => observers[0].callback([{ isIntersecting: true }]));

    const script = adScript();
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect(script?.src).toContain('client=ca-pub-123456');
    expect(window.adsbygoogle).toHaveLength(1);
  });

  it('aceptar todo después del montaje dispara la carga', () => {
    setAdsEnv();

    render(<AdSlot placement="home" locale="es" />);
    expect(observers).toHaveLength(0);

    act(() => {
      grantConsent('all');
      window.dispatchEvent(new CustomEvent('quizverse:consent', { detail: { level: 'all' } }));
    });

    expect(observers).toHaveLength(1);
    act(() => observers[0].callback([{ isIntersecting: true }]));
    expect(adScript()).not.toBeNull();
  });
});
