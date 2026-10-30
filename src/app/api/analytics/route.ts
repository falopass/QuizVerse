import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';

// No crítico: si Redis cae, degradamos abierto en vez de tumbar analytics.
const analyticsLimiter = createRateLimiter('api', 100, 60, 'open');

const metadataSchema = z
  .record(z.string(), z.union([z.string().max(120), z.number(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 10, { message: 'too_many_keys' });

const analyticsSchema = z.object({
  name: z.enum([
    'page_view',
    'locale_switch',
    'quiz_start',
    'quiz_complete',
    'create_start',
    'create_complete',
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
  const ip = clientIpFromHeaders(request.headers);
  const { allowed } = await analyticsLimiter.check(`analytics:${ip}`);
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
    const parsed = analyticsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    const payload = parsed.data;

    console.info(
      JSON.stringify({
        channel: 'analytics',
        at: new Date().toISOString(),
        ...payload,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('analytics-route-failed', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
