import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter } from '@/lib/utils/rate-limit';

const VALID_NAMES = new Set([
  'page_view',
  'locale_switch',
  'quiz_start',
  'quiz_complete',
  'create_start',
  'create_complete',
  'client_error',
]);

export async function POST(request: NextRequest) {
  const { headers } = request;
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = await apiLimiter.check(`analytics:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const payload = (await request.json()) as {
      name?: string;
      locale?: string;
      path?: string;
      quizId?: string;
      quizSlug?: string;
      quizType?: string;
      source?: string;
      value?: number;
      metadata?: Record<string, unknown>;
    };

    if (!payload.name || !VALID_NAMES.has(payload.name)) {
      return NextResponse.json({ error: 'Invalid analytics event' }, { status: 400 });
    }

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
