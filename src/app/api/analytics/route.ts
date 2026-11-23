import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { hasOversizedContentLength, readBoundedJson } from '@/lib/utils/read-bounded-body';
import { normalizeAnalyticsEvent, persistAnalyticsEvent } from '@/lib/telemetry/persist';

/** Tope de bytes previo a JSON.parse para beacons públicos. */
const MAX_BODY_BYTES = 8 * 1024;

// No crítico: si Redis/binding caen o faltan, degradamos abierto en vez de tumbar analytics.
const analyticsLimiter = createRateLimiter('api', 100, 60, 'open');

const metadataSchema = z
  .record(z.string(), z.union([z.string().max(120), z.number().finite(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 10, { message: 'too_many_keys' });

const analyticsSchema = z.object({
  name: z.enum([
    'page_view',
    'locale_switch',
    'quiz_start',
    'quiz_complete',
    'create_start',
    'create_complete',
    'share_click',
    'invite_landing',
    'client_error',
    'web_vitals',
  ]),
  locale: z.enum(['en', 'es']).optional(),
  path: z.string().max(300).optional(),
  quizId: z.string().max(120).optional(),
  quizSlug: z.string().max(120).optional(),
  quizType: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  value: z.number().finite().optional(),
  message: z.string().max(500).optional(),
  metadata: metadataSchema.optional(),
});

export async function POST(request: Request) {
  if (hasOversizedContentLength(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const { allowed } = await analyticsLimiter.check(`analytics:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const bodyResult = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    const status = bodyResult.reason === 'payload_too_large' ? 413 : 400;
    return NextResponse.json({ error: bodyResult.reason }, { status });
  }

  try {
    const parsed = analyticsSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const payload = parsed.data;
    const normalized = normalizeAnalyticsEvent(payload);

    // eslint-disable-next-line no-console -- log estructurado normalizado hacia Workers Logs
    console.info(
      JSON.stringify({
        channel: 'analytics',
        signal: 'beacon_estimated',
        at: new Date().toISOString(),
        name: normalized.name,
        ...(normalized.locale ? { locale: normalized.locale } : {}),
        ...(normalized.path ? { path: normalized.path } : {}),
        ...(normalized.quizId ? { quizId: normalized.quizId } : {}),
        ...(normalized.quizSlug ? { quizSlug: normalized.quizSlug } : {}),
        ...(normalized.quizType ? { quizType: normalized.quizType } : {}),
        ...(normalized.source ? { source: normalized.source } : {}),
        ...(normalized.value !== null ? { value: normalized.value } : {}),
        ...(normalized.message ? { message: normalized.message } : {}),
        ...(normalized.metadata ? { metadata: normalized.metadata } : {}),
      })
    );

    // Migración 022: los eventos de la lista blanca también se guardan en
    // analytics_events. Best-effort — persist nunca lanza; si falta la tabla
    // o la clave, el evento queda solo en el log, como antes.
    await persistAnalyticsEvent(payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('analytics-route-failed', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
