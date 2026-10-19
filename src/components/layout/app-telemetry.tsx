'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent, reportClientError } from '@/lib/telemetry/client';
import { CONSENT_KEY, hasAnalyticsConsent } from '@/components/shared/cookie-consent';

export function AppTelemetry() {
  const pathname = usePathname();

  const sendPageView = React.useCallback(() => {
    if (!pathname) return;

    // En /embed/{locale}/... el idioma es el segundo segmento, no el primero.
    const segments = pathname.split('/');
    const locale = segments[1] === 'embed' ? segments[2] : segments[1];
    void trackEvent({
      name: 'page_view',
      path: pathname,
      locale: locale === 'es' || locale === 'en' ? locale : undefined,
    });
  }, [pathname]);

  React.useEffect(() => {
    sendPageView();
  }, [sendPageView]);

  React.useEffect(() => {
    const handleConsent = (event: Event) => {
      if ((event as CustomEvent<{ level?: string }>).detail?.level === 'all') sendPageView();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY && hasAnalyticsConsent()) sendPageView();
    };

    window.addEventListener('quizverse:consent', handleConsent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('quizverse:consent', handleConsent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [sendPageView]);

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
