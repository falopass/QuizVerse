'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent as sendEvent, type TelemetryEventName } from '@/lib/telemetry/client';

export function trackEvent(name: TelemetryEventName, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  sendEvent({ name, path: window.location.pathname, ...data });
}

export function useTelemetry() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      trackEvent('page_view');
      prevPath.current = pathname;
    }
  }, [pathname]);

  const track = useCallback((name: TelemetryEventName, data?: Record<string, unknown>) => {
    trackEvent(name, data);
  }, []);

  return { track };
}
