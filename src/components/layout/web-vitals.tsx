'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { trackEvent } from '@/lib/telemetry/client';
import { hasAnalyticsConsent } from '@/components/shared/cookie-consent';

interface VitalMetric {
  name: string;
  value: number;
  rating?: string;
}

// Solo las Core Web Vitals: cada una dispara a lo sumo un POST, así una carga de
// página suma máximo 3 eventos y no quema el rate limit de /api/analytics.
const REPORTED_NAMES = new Set(['LCP', 'CLS', 'INP']);

export function WebVitals() {
  const pathname = usePathname();
  const reported = React.useRef(new Set<string>());

  // useReportWebVitals reinvoca un callback nuevo con todas las métricas ya
  // capturadas; el set `reported` evita que una navegación reenvíe lo ya enviado.
  const report = React.useCallback(
    (metric: VitalMetric) => {
      if (!REPORTED_NAMES.has(metric.name) || reported.current.has(metric.name)) return;
      if (!hasAnalyticsConsent()) return;
      reported.current.add(metric.name);

      // En /embed/{locale}/... el idioma es el segundo segmento, no el primero.
      const segments = (pathname ?? '').split('/');
      const localeSegment = segments[1] === 'embed' ? segments[2] : segments[1];
      void trackEvent({
        name: 'web_vitals',
        path: pathname ?? undefined,
        locale: localeSegment === 'es' || localeSegment === 'en' ? localeSegment : undefined,
        value: metric.value,
        metadata: { metric: metric.name, rating: metric.rating },
      });
    },
    [pathname]
  );

  useReportWebVitals(report);

  return null;
}
