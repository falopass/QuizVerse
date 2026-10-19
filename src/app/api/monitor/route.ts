import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/utils/rate-limit';

// No crítico: si Redis cae, degradamos abierto en vez de tumbar el monitor.
const monitorLimiter = createRateLimiter('api', 100, 60, 'open');

export async function POST(request: NextRequest) {
  const { headers } = request;
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = await monitorLimiter.check(`monitor:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const payload = (await request.json()) as {
      message?: string;
      path?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    };

    if (!payload.message) {
      return NextResponse.json({ error: 'Missing error message' }, { status: 400 });
    }

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
