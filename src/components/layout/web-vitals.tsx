'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { trackEvent } from '@/lib/telemetry/client';
import { CONSENT_KEY, hasAnalyticsConsent } from '@/components/shared/cookie-consent';

interface VitalMetric {
  id: string;
  name: string;
  value: number;
  rating?: string;
}

// Solo las Core Web Vitals: cada una dispara a lo sumo un POST por ciclo de
// medición, así una carga de página suma máximo 3 eventos y no quema el rate
// limit de /api/analytics.
const REPORTED_NAMES = new Set(['LCP', 'CLS', 'INP']);

export function WebVitals() {
  const pathname = usePathname();
  // Las CWV miden el documento completo, no la ruta SPA: se etiquetan con la
  // ruta de la carga inicial, no con la última vista tras navegar.
  const pathRef = React.useRef(pathname);
  // Se deduplica por metric.id (único por ciclo): una restauración desde bfcache
  // publica métricas con ids nuevos y debe poder reportar de nuevo.
  const reported = React.useRef(new Set<string>());
  // Métricas capturadas sin consentimiento: se conserva el último valor por
  // nombre y se envían cuando el consentimiento llega (banner u otra pestaña).
  const pending = React.useRef(new Map<string, VitalMetric>());

  const send = React.useCallback((metric: VitalMetric) => {
    reported.current.add(metric.id);
    // En /embed/{locale}/... el idioma es el segundo segmento, no el primero.
    const segments = (pathRef.current ?? '').split('/');
    const localeSegment = segments[1] === 'embed' ? segments[2] : segments[1];
    void trackEvent({
      name: 'web_vitals',
      path: pathRef.current ?? undefined,
      locale: localeSegment === 'es' || localeSegment === 'en' ? localeSegment : undefined,
      value: metric.value,
      metadata: { metric: metric.name, rating: metric.rating },
    });
  }, []);

  // useReportWebVitals reinvoca un callback nuevo con todas las métricas ya
  // capturadas; el set `reported` evita que una navegación reenvíe lo ya enviado.
  const report = React.useCallback(
    (metric: VitalMetric) => {
      if (!REPORTED_NAMES.has(metric.name) || reported.current.has(metric.id)) return;
      if (!hasAnalyticsConsent()) {
        pending.current.set(metric.name, metric);
        return;
      }
      pending.current.delete(metric.name);
      send(metric);
    },
    [send]
  );

  useReportWebVitals(report);

  React.useEffect(() => {
    const flush = () => {
      if (!hasAnalyticsConsent()) return;
      pending.current.forEach((metric) => {
        if (!reported.current.has(metric.id)) send(metric);
      });
      pending.current.clear();
    };
    const handleConsent = (event: Event) => {
      if ((event as CustomEvent<{ level?: string }>).detail?.level === 'all') flush();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY) flush();
    };

    window.addEventListener('quizverse:consent', handleConsent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('quizverse:consent', handleConsent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [send]);

  return null;
}
