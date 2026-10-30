/**
 * POST /api/quiz/report
 *
 * Flags a published quiz for moderation. Public by design — a visitor who spots
 * a broken or offensive quiz should be able to say so without an account — so it
 * is rate limited per IP and validated with Zod.
 *
 * 200: { success: true }
 * 400: { error: 'invalid_payload' }
 * 429: { error: 'rate_limited' }
 * 500: { error: 'insert_failed' }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';

const ReportSchema = z.object({
  quiz_id: z.string().uuid(),
  quiz_slug: z.string().max(120).optional(),
  reason: z.enum(['inappropriate', 'spam', 'incorrect_info', 'hate_speech', 'copyright', 'other']),
  details: z.string().max(1000).optional(),
});

/** Eight reports per IP every ten minutes: enough for a real complaint, not for spam. */
const reportLimiter = createRateLimiter('quiz-report', 8, 600);

function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

export async function POST(request: Request) {
  const { allowed } = await reportLimiter.check(clientIp(request));
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('quiz_reports').insert({
    quiz_id: parsed.data.quiz_id,
    reporter_id: user?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details?.trim() || null,
  });

  if (error) {
    console.error('quiz-report-insert-failed', {
      quizSlug: parsed.data.quiz_slug,
      quizId: parsed.data.quiz_id,
      reason: parsed.data.reason,
      reporterId: user?.id ?? null,
      error,
    });
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
