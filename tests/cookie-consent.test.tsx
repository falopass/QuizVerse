import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ pathname: '/es/explore' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

import {
  CONSENT_KEY,
  COOKIE_PREFERENCES_EVENT,
  CookieConsentBanner,
} from '@/components/shared/cookie-consent';

beforeEach(() => {
  localStorage.clear();
  mocks.pathname = '/es/explore';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function showBanner() {
  const rendered = render(<CookieConsentBanner />);
  act(() => {
    vi.advanceTimersByTime(800);
  });
  return rendered;
}

describe('CookieConsentBanner con transiciones CSS', () => {
  it('aparece a los 800 ms con el texto del locale', () => {
    const { container } = render(<CookieConsentBanner />);

    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(container).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector('.cookie-consent-banner')).toBeInTheDocument();
    expect(screen.getByText(/^Este sitio usa cookies\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar todo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solo esenciales' })).toBeInTheDocument();
  });

  it('usa el texto en inglés en /en', () => {
    mocks.pathname = '/en/explore';
    showBanner();

    expect(screen.getByText(/^This site uses cookies\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeInTheDocument();
  });

  it('no aparece si ya hay consentimiento guardado', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ level: 'essential', version: 2, timestamp: Date.now() })
    );

    const { container } = render(<CookieConsentBanner />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('aceptar todo guarda el consentimiento, avisa y desmonta al terminar la salida', () => {
    const listener = vi.fn();
    window.addEventListener('quizverse:consent', listener);
    const { container } = showBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar todo' }));

    expect(JSON.parse(localStorage.getItem(CONSENT_KEY) as string)).toMatchObject({
      level: 'all',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    const banner = container.querySelector('.cookie-consent-banner') as Element;
    expect(banner).toHaveClass('cookie-banner-exit');

    fireEvent.animationEnd(banner);
    expect(container).toBeEmptyDOMElement();
    window.removeEventListener('quizverse:consent', listener);
  });

  it('solo esenciales guarda el nivel essential y un doble clic no repite el aviso', () => {
    const listener = vi.fn();
    window.addEventListener('quizverse:consent', listener);
    const { container } = showBanner();

    const button = screen.getByRole('button', { name: 'Solo esenciales' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(JSON.parse(localStorage.getItem(CONSENT_KEY) as string)).toMatchObject({
      level: 'essential',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    fireEvent.animationEnd(container.querySelector('.cookie-consent-banner') as Element);
    expect(container).toBeEmptyDOMElement();
    window.removeEventListener('quizverse:consent', listener);
  });

  it('reabre el banner con consentimiento guardado al pedir preferencias', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ level: 'essential', version: 2, timestamp: Date.now() })
    );

    const { container } = render(<CookieConsentBanner />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container).toBeEmptyDOMElement();

    act(() => {
      window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT));
    });

    expect(container.querySelector('.cookie-consent-banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar todo' })).toBeInTheDocument();
  });

  it('el fin de la animación de entrada no desmonta el banner', () => {
    const { container } = showBanner();

    fireEvent.animationEnd(container.querySelector('.cookie-consent-banner') as Element);

    expect(container.querySelector('.cookie-consent-banner')).toBeInTheDocument();
  });
});
