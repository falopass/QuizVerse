export type TelemetryEventName =
  | 'page_view'
  | 'locale_switch'
  | 'quiz_start'
  | 'quiz_complete'
  | 'create_start'
  | 'create_complete'
  | 'client_error';

export interface TelemetryEventPayload {
  name: TelemetryEventName;
  locale?: string;
  path?: string;
  quizId?: string;
  quizSlug?: string;
  quizType?: string;
  source?: string;
  value?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export async function trackEvent(payload: TelemetryEventPayload) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort telemetry only.
  }
}

export async function reportClientError(input: {
  message: string;
  path?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // Best-effort monitoring only.
  }
}
