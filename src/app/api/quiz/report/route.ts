import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_REASONS = new Set([
  'inappropriate',
  'spam',
  'incorrect_info',
  'hate_speech',
  'copyright',
  'other',
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      quiz_id?: string;
      quiz_slug?: string;
      reason?: string;
      details?: string;
    };

    if (!body.quiz_id || !body.reason || !VALID_REASONS.has(body.reason)) {
      return NextResponse.json({ error: 'Invalid report payload' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      quiz_id: body.quiz_id,
      reporter_id: user?.id ?? null,
      reason: body.reason,
      details: body.details?.trim() || null,
    };

    const { error } = await supabase.from('quiz_reports').insert(payload as never);

    if (error) {
      console.error('quiz-report-insert-failed', {
        quizSlug: body.quiz_slug,
        quizId: body.quiz_id,
        reason: body.reason,
        reporterId: user?.id ?? null,
        error,
      });

      return NextResponse.json({ error: 'Could not submit report' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('quiz-report-route-failed', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
