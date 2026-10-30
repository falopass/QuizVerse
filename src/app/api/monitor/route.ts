import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';

// No crítico: si Redis cae, degradamos abierto en vez de tumbar el monitor.
const monitorLimiter = createRateLimiter('api', 100, 60, 'open');

const metadataSchema = z
  .record(z.string(), z.union([z.string().max(120), z.number(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 10, { message: 'too_many_keys' });

const monitorSchema = z.object({
  message: z.string().min(1).max(500),
  path: z.string().max(300).optional(),
  source: z.string().max(60).optional(),
  metadata: metadataSchema.optional(),
});

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const { allowed } = await monitorLimiter.check(`monitor:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const parsed = monitorSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const payload = parsed.data;

    console.error(
      JSON.stringify({
        channel: 'monitor',
        at: new Date().toISOString(),
        ...payload,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('monitor-route-failed', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
