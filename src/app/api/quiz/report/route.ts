/**
 * POST /api/quiz/report
 *
 * Flags a published quiz for moderation. Public by design — a visitor who spots
 * a broken or offensive quiz should be able to say so without an account — so it
 * is rate limited per IP, size-bounded before JSON parsing, validated with Zod,
 * checked against published quizzes, and written through the validated server
 * client (service role when configured, SSR client fallback while migration 023
 * is pending).
 *
 * 200: { success: true } | { success: true, deduplicated: true }
 * 400: { error: 'invalid_payload' }
 * 404: { error: 'quiz_not_found' }
 * 413: { error: 'payload_too_large' }
 * 429: { error: 'rate_limited' }
 * 503: { error: 'rate_limiter_unavailable' }
 * 500: { error: 'insert_failed' }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createRateLimiter } from '@/lib/utils/rate-limit';
import { clientIpFromHeaders } from '@/lib/utils/client-ip';
import { hasOversizedContentLength, readBoundedJson } from '@/lib/utils/read-bounded-body';
import { sanitizePublicSlug } from '@/lib/telemetry/persist';
import type { Database } from '@/types/database';

const MAX_BODY_BYTES = 8 * 1024;

const ReportSchema = z.object({
  quiz_id: z.string().uuid(),
  quiz_slug: z.string().max(120).optional(),
  reason: z.enum(['inappropriate', 'spam', 'incorrect_info', 'hate_speech', 'copyright', 'other']),
  details: z.string().max(1000).optional(),
});

/** Eight reports per IP every ten minutes: enough for a real complaint, not for spam. */
const reportLimiter = createRateLimiter('quiz-report', 8, 600);

type QuizReportInsert = Database['public']['Tables']['quiz_reports']['Insert'] & {
  reporter_fingerprint?: string | null;
};

function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

/**
 * Huella anónima sin PII (SHA-256) para deduplicar reportes abiertos del
 * mismo origen sobre el mismo quiz sin guardar la IP en la base de datos.
 */
async function anonymousReportFingerprint(quizId: string, ip: string): Promise<string> {
  const salt =
    process.env.QUIZ_ATTEMPT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'quizverse-report-v1';
  const payload = new TextEncoder().encode(`quiz-report:${salt}:${quizId}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** PostgREST/SQL cuando `reporter_fingerprint` aún no existe (migración 023 pendiente). */
function isMissingFingerprintColumnError(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? '';
  return (
    (error.code === 'PGRST204' || error.code === '42703') && /reporter_fingerprint/i.test(message)
  );
}

export async function POST(request: Request) {
  if (hasOversizedContentLength(request, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const ip = clientIp(request);
  const limit = await reportLimiter.check(ip);
  if (limit.errored && !limit.allowed) {
    return NextResponse.json({ error: 'rate_limiter_unavailable' }, { status: 503 });
  }
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const read = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!read.ok) {
    if (read.reason === 'payload_too_large') {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    }
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(read.data);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Escritor validado de servidor: con migración 023 aplicada, anon/authenticated
  // ya no tienen INSERT directo en quiz_reports y solo service_role escribe.
  // Si falta SUPABASE_SERVICE_ROLE_KEY (tests/entornos sin 023), cae al cliente SSR.
  const writer = createServiceClient() ?? supabase;

  const { data: quiz, error: quizError } = await writer
    .from('quizzes')
    .select('id, title, slug, status')
    .eq('id', parsed.data.quiz_id)
    .eq('status', 'published')
    .maybeSingle();

  if (quizError) {
    console.error('quiz-report-target-lookup-failed', {
      quizId: parsed.data.quiz_id,
      error: quizError,
    });
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  if (!quiz) {
    return NextResponse.json({ error: 'quiz_not_found' }, { status: 404 });
  }

  const reporterId = user?.id ?? null;
  const details = parsed.data.details?.trim() || null;
  const baseRow: Database['public']['Tables']['quiz_reports']['Insert'] = {
    quiz_id: quiz.id,
    quiz_title: quiz.title,
    quiz_slug: quiz.slug,
    reporter_id: reporterId,
    reason: parsed.data.reason,
    details,
  };

  const rowWithFingerprint: QuizReportInsert = reporterId
    ? baseRow
    : { ...baseRow, reporter_fingerprint: await anonymousReportFingerprint(quiz.id, ip) };

  let { error } = await writer
    .from('quiz_reports')
    .insert(rowWithFingerprint as Database['public']['Tables']['quiz_reports']['Insert']);

  // Compatibilidad mientras la migración 023 no se haya aplicado en producción:
  // reintenta sin `reporter_fingerprint` cuando la columna aún no existe.
  if (error && !reporterId && isMissingFingerprintColumnError(error)) {
    ({ error } = await writer.from('quiz_reports').insert(baseRow));
  }

  if (error) {
    // 23505: ya existe un reporte abierto del mismo usuario o huella anónima.
    // Respondemos 200 idempotente para no filtrar existencia de reportes previos.
    if (error.code === '23505') {
      return NextResponse.json({ success: true, deduplicated: true });
    }
    console.error('quiz-report-insert-failed', {
      quizSlug: sanitizePublicSlug(quiz.slug ?? parsed.data.quiz_slug),
      quizId: quiz.id,
      reason: parsed.data.reason,
      reporterId,
      error,
    });
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
