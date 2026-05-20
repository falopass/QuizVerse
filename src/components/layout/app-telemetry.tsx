'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent, reportClientError } from '@/lib/telemetry/client';

export function AppTelemetry() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!pathname) return;

    const locale = pathname.split('/')[1];
    void trackEvent({
      name: 'page_view',
      path: pathname,
      locale: locale === 'es' || locale === 'en' ? locale : undefined,
    });
  }, [pathname]);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      void reportClientError({
        message: event.message || 'Unknown window error',
        path: window.location.pathname,
        source: 'window.error',
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      void reportClientError({
        message:
          event.reason instanceof Error
            ? event.reason.message
            : typeof event.reason === 'string'
              ? event.reason
              : 'Unhandled promise rejection',
        path: window.location.pathname,
        source: 'window.unhandledrejection',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
