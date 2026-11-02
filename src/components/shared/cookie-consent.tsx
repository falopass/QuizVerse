'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { localeFromPathname } from '@/lib/i18n/navigation';

type ConsentLevel = 'none' | 'essential' | 'all';

export const CONSENT_KEY = 'quizverse-cookie-consent';
const CONSENT_VERSION = 1;

interface ConsentState {
  level: ConsentLevel;
  version: number;
  timestamp: number;
}

function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent(level: ConsentLevel) {
  const previous = getStoredConsent()?.level ?? 'none';
  const state: ConsentState = { level, version: CONSENT_VERSION, timestamp: Date.now() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('quizverse:consent', { detail: { level, previous } }));
}

export function getConsentLevel(): ConsentLevel {
  const stored = getStoredConsent();
  return stored?.level ?? 'none';
}

/** Evento que reabre el banner (enlace «Preferencias de cookies» del footer). */
export const COOKIE_PREFERENCES_EVENT = 'quizverse:cookie-preferences';

export function hasAnalyticsConsent(): boolean {
  return getConsentLevel() === 'all';
}

const copy = {
  title: { en: 'This site uses cookies.', es: 'Este sitio usa cookies.' },
  body: {
    en: 'Essential cookies run the site. You can also allow analytics to help us improve it.',
    es: 'Las cookies esenciales hacen funcionar el sitio. También puedes permitir las analíticas para ayudarnos a mejorarlo.',
  },
  essentialLabel: { en: 'Essential', es: 'Esenciales' },
  analyticsLabel: { en: 'Analytics', es: 'Analíticas' },
  essentialButton: { en: 'Essential only', es: 'Solo esenciales' },
  acceptAllButton: { en: 'Accept all', es: 'Aceptar todo' },
};

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const pathname = usePathname();
  const locale = localeFromPathname(pathname);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = getStoredConsent();
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const reopen = () => {
      setExiting(false);
      setVisible(true);
    };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, reopen);
  }, []);

  const dismiss = useCallback(
    (level: ConsentLevel) => {
      if (exiting) return;
      storeConsent(level);
      setExiting(true);
    },
    [exiting]
  );

  const acceptAll = useCallback(() => dismiss('all'), [dismiss]);

  const acceptEssential = useCallback(() => dismiss('essential'), [dismiss]);

  // Dentro de un iframe ajeno el banner taparía el quiz; una visita directa a
  // /embed sí conserva el flujo normal de consentimiento.
  if (
    pathname?.startsWith('/embed') &&
    typeof window !== 'undefined' &&
    window.self !== window.top
  ) {
    return null;
  }

  return (
    visible && (
      <div
        className={cn('cookie-consent-banner', exiting && 'cookie-banner-exit')}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && exiting) setVisible(false);
        }}
      >
        <div className="cookie-consent-inner">
          <div className="text-text-secondary max-w-xl text-sm leading-relaxed">
            <p>
              <span className="text-text-primary font-semibold">{copy.title[locale]} </span>
              {copy.body[locale]}
            </p>
          </div>
          <div className="cookie-consent-actions">
            <button onClick={acceptEssential} className="cookie-consent-secondary">
              {copy.essentialButton[locale]}
            </button>
            <button onClick={acceptAll} className="arcade-button">
              {copy.acceptAllButton[locale]}
            </button>
          </div>
        </div>
      </div>
    )
  );
}
