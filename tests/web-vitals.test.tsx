import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

type ReportedMetric = { name: string; value: number; rating?: string };
type VitalsCallback = (metric: ReportedMetric) => void;

const vitalsCallbacks: VitalsCallback[] = [];

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (cb: VitalsCallback) => {
    vitalsCallbacks.push(cb);
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/explore',
}));

vi.mock('@/lib/telemetry/client', () => ({ trackEvent: vi.fn() }));

import { trackEvent } from '@/lib/telemetry/client';
import { WebVitals } from '@/components/layout/web-vitals';
import { CONSENT_KEY } from '@/components/shared/cookie-consent';

function setConsent(level: 'essential' | 'all') {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ level, version: 1, timestamp: Date.now() }));
}

function emit(metric: ReportedMetric) {
  const cb = vitalsCallbacks.at(-1);
  if (!cb) throw new Error('useReportWebVitals no registró callback');
  act(() => cb(metric));
}

function sentMetrics(): string[] {
  return vi
    .mocked(trackEvent)
    .mock.calls.map((call) => (call[0].metadata as { metric: string }).metric);
}

beforeEach(() => {
  localStorage.clear();
  vitalsCallbacks.length = 0;
  vi.mocked(trackEvent).mockClear();
});

describe('WebVitals', () => {
  it('reporta LCP, CLS e INP una sola vez cada una con consentimiento', () => {
    setConsent('all');
    render(React.createElement(WebVitals));

    emit({ name: 'LCP', value: 2400, rating: 'good' });
    emit({ name: 'LCP', value: 2500, rating: 'needs-improvement' });
    emit({ name: 'CLS', value: 0.05, rating: 'good' });
    emit({ name: 'INP', value: 180, rating: 'good' });

    expect(trackEvent).toHaveBeenCalledTimes(3);
    expect(trackEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'web_vitals',
        path: '/es/explore',
        locale: 'es',
        value: 2400,
        metadata: { metric: 'LCP', rating: 'good' },
      })
    );
    expect(sentMetrics()).toEqual(['LCP', 'CLS', 'INP']);
  });

  it('no envía nada sin decisión de consentimiento', () => {
    render(React.createElement(WebVitals));

    emit({ name: 'LCP', value: 2400, rating: 'good' });
    emit({ name: 'CLS', value: 0.05, rating: 'good' });
    emit({ name: 'INP', value: 180, rating: 'good' });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('no envía nada con consentimiento essential', () => {
    setConsent('essential');
    render(React.createElement(WebVitals));

    emit({ name: 'LCP', value: 2400, rating: 'good' });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('ignora FCP, TTFB, FID y las métricas internas de Next', () => {
    setConsent('all');
    render(React.createElement(WebVitals));

    emit({ name: 'FCP', value: 900, rating: 'good' });
    emit({ name: 'TTFB', value: 300, rating: 'good' });
    emit({ name: 'FID', value: 40, rating: 'good' });
    emit({ name: 'Next.js-hydration', value: 120 });
    emit({ name: 'Next.js-route-change-to-render', value: 80 });

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
