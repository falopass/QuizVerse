'use client';

import { useState, useEffect, useCallback } from 'react';
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
    en: 'We use essential cookies for platform functionality and analytics cookies to improve the experience. You can choose which cookies to accept.',
    es: 'Usamos cookies esenciales para el funcionamiento de la plataforma y cookies analíticas para mejorar la experiencia. Podés elegir qué cookies aceptar.',
  },
  essentialLabel: { en: 'Essential', es: 'Esenciales' },
  analyticsLabel: { en: 'Analytics', es: 'Analíticas' },
  essentialButton: { en: 'Essential only', es: 'Solo esenciales' },
  acceptAllButton: { en: 'Accept all', es: 'Aceptar todo' },
};

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<'en' | 'es'>('en');

  useEffect(() => {
    setMounted(true);
    setLocale(getLocale());
    const stored = getStoredConsent();
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

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

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-bg-secondary border-border-subtle fixed right-0 bottom-0 left-0 z-[100] border-t p-4 shadow-2xl sm:p-6"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-text-secondary max-w-xl text-sm leading-relaxed">
              <p>
                <span className="text-text-primary font-semibold">{copy.title[locale]} </span>
                {copy.body[locale]}
              </p>
              <div className="mt-2 flex gap-4 text-xs">
                <span className="text-text-muted flex items-center gap-1">
                  <span className="bg-success/20 text-success inline-block h-2 w-2 rounded-full" />
                  {copy.essentialLabel[locale]}
                </span>
                <span className="text-text-muted flex items-center gap-1">
                  <span className="bg-accent-primary/20 text-accent-primary inline-block h-2 w-2 rounded-full" />
                  {copy.analyticsLabel[locale]}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={acceptEssential}
                className="text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                {copy.essentialButton[locale]}
              </button>
              <button
                onClick={acceptAll}
                className="bg-accent-primary hover:bg-accent-hover rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-primary/25 transition-all hover:shadow-xl"
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
