import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { hasOversizedContentLength, readBoundedJson } from '@/lib/utils/read-bounded-body';
import {
  sanitizeEventPath,
  sanitizePublicMetadata,
  sanitizePublicText,
  sanitizePublicToken,
} from '@/lib/telemetry/persist';

/** Tope de bytes previo a JSON.parse para reportes de error cliente. */
const MAX_BODY_BYTES = 8 * 1024;

// No crítico: si Redis/binding caen o faltan, degradamos abierto en vez de tumbar el monitor.
const monitorLimiter = createRateLimiter('api', 100, 60, 'open');

const metadataSchema = z
  .record(z.string(), z.union([z.string().max(120), z.number().finite(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 10, { message: 'too_many_keys' });

const monitorSchema = z.object({
  message: z.string().min(1).max(500),
  path: z.string().max(300).optional(),
  source: z.string().max(60).optional(),
  metadata: metadataSchema.optional(),
});

export async function POST(request: Request) {
  if (hasOversizedContentLength(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const { allowed } = await monitorLimiter.check(`monitor:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const bodyResult = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    const status = bodyResult.reason === 'payload_too_large' ? 413 : 400;
    return NextResponse.json({ error: bodyResult.reason }, { status });
  }

  try {
    const parsed = monitorSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const payload = parsed.data;
    const message = sanitizePublicText(payload.message, 500);
    if (!message) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const path = sanitizeEventPath(payload.path);
    const source = sanitizePublicToken(payload.source, 60);
    const metadata = sanitizePublicMetadata(payload.metadata);

    console.error(
      JSON.stringify({
        channel: 'monitor',
        signal: 'client_error_beacon',
        at: new Date().toISOString(),
        message,
        ...(path ? { path } : {}),
        ...(source ? { source } : {}),
        ...(metadata ? { metadata } : {}),
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('monitor-route-failed', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
