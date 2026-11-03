'use client';

import { useEffect, useRef, useState } from 'react';
import { hasAdsConsent } from '@/components/shared/cookie-consent';
import { adsPublisherId, adsSlotId, type AdPlacement } from '@/lib/ads/config';
import type { Locale } from '@/lib/i18n/dictionaries';

/**
 * Alto fijo del anuncio. El hueco se reserva desde el primer render para que
 * la carga del iframe no mueva el contenido (CLS 0).
 */
const AD_HEIGHT = 100;

const LABEL: Record<Locale, string> = { en: 'Advertisement', es: 'Publicidad' };

const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function ensureAdSenseScript(publisherId: string) {
  if (document.querySelector('script[data-quizverse-adsense]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.quizverseAdsense = '';
  script.src = `${ADSENSE_SCRIPT}?client=${encodeURIComponent(publisherId)}`;
  document.head.appendChild(script);
}

interface AdSlotProps {
  placement: AdPlacement;
  locale: Locale;
}

/**
 * Hueco publicitario inerte por defecto: sin publisher ID y slot configurados
 * no renderiza nada, ni espacio reservado. Con ambos, reserva altura fija y
 * solo pide el anuncio cuando hay consentimiento y el hueco se acerca al
 * viewport. Nunca se usa en /play, /result, /embed, login, registro ni admin.
 */
export function AdSlot({ placement, locale }: AdSlotProps) {
  const publisherId = adsPublisherId();
  const slotId = adsSlotId(placement);
  const enabled = Boolean(publisherId && slotId);
  const slotRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => setConsented(hasAdsConsent());
    sync();
    window.addEventListener('quizverse:consent', sync);
    return () => window.removeEventListener('quizverse:consent', sync);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !consented || pushed.current || !publisherId) return;
    const node = slotRef.current;
    if (!node) return;

    let cancelled = false;
    const load = () => {
      if (cancelled || pushed.current) return;
      pushed.current = true;
      ensureAdSenseScript(publisherId);
      const queue = (window.adsbygoogle = window.adsbygoogle || []);
      queue.push({});
    };

    // Sin IntersectionObserver (navegadores muy viejos) se carga al montar:
    // el consentimiento ya está dado y el hueco existe.
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [consented, enabled, publisherId]);

  if (!publisherId || !slotId) return null;

  return (
    <div
      className="border-border-subtle bg-bg-secondary mx-auto w-full max-w-[970px] rounded-[4px] border px-2 pt-1"
      data-ad-placement={placement}
    >
      <span className="text-text-muted block text-[10px] font-semibold">{LABEL[locale]}</span>
      <ins
        ref={slotRef}
        className="adsbygoogle block w-full"
        style={{ display: 'block', height: AD_HEIGHT }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format="horizontal"
      />
    </div>
  );
}
