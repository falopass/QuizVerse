'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ConsentLevel = 'none' | 'essential' | 'all';

const CONSENT_KEY = 'quizverse-cookie-consent';
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
  const state: ConsentState = { level, version: CONSENT_VERSION, timestamp: Date.now() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
}

export function getConsentLevel(): ConsentLevel {
  const stored = getStoredConsent();
  return stored?.level ?? 'none';
}

export function hasAnalyticsConsent(): boolean {
  return getConsentLevel() === 'all';
}

function getLocale(): 'en' | 'es' {
  if (typeof window === 'undefined') return 'en';
  const lang = document.documentElement.lang;
  return lang === 'es' ? 'es' : 'en';
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
  const [locale, setLocale] = useState<'en' | 'es'>('en');
  const initialized = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setLocale(getLocale());
    const stored = getStoredConsent();
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const acceptAll = useCallback(() => {
    storeConsent('all');
    setVisible(false);
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { level: 'all' } }));
  }, []);

  const acceptEssential = useCallback(() => {
    storeConsent('essential');
    setVisible(false);
    window.dispatchEvent(
      new CustomEvent('cookie-consent-changed', { detail: { level: 'essential' } })
    );
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="cookie-consent-banner"
        >
          <div className="cookie-consent-inner">
            <div className="text-text-secondary max-w-xl text-sm leading-relaxed">
              <p>
                <span className="text-text-primary font-semibold">{copy.title[locale]} </span>
                {copy.body[locale]}
              </p>
            </div>
            <div className="cookie-consent-actions">
              <button
                onClick={acceptEssential}
                className="cookie-consent-secondary"
              >
                {copy.essentialButton[locale]}
              </button>
              <button
                onClick={acceptAll}
                className="arcade-button"
              >
                {copy.acceptAllButton[locale]}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
