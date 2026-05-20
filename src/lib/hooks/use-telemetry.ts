'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type TelemetryEvent = 'page_view' | 'quiz_start' | 'quiz_complete' | 'quiz_share' | 'click';

interface TelemetryPayload {
  event: TelemetryEvent;
  path: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const TELEMETRY_BUFFER: TelemetryPayload[] = [];
const FLUSH_INTERVAL_MS = 30_000;
let flushTimer: ReturnType<typeof setInterval> | null = null;

async function flush() {
  if (TELEMETRY_BUFFER.length === 0) return;
  const batch = TELEMETRY_BUFFER.splice(0);

  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'internal' },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Re-queue silently — no-op in development
    TELEMETRY_BUFFER.unshift(...batch.slice(0, 20));
  }
}

function ensureFlushTimer() {
  if (typeof window === 'undefined') return;
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

export function trackEvent(event: TelemetryEvent, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  ensureFlushTimer();

  TELEMETRY_BUFFER.push({
    event,
    path: window.location.pathname,
    data,
    timestamp: Date.now(),
  });

  if (TELEMETRY_BUFFER.length >= 10) {
    flush();
  }
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

  const track = useCallback((event: TelemetryEvent, data?: Record<string, unknown>) => {
    trackEvent(event, data);
  }, []);

  return { track };
}
