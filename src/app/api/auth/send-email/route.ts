/**
 * POST /api/auth/send-email — Send Email Hook de GoTrue.
 *
 * GoTrue (Supabase auto-hospedado) llama aquí en vez de un SMTP: cada correo
 * de auth (alta, recuperación, magic link, invitación, cambio de correo,
 * reautenticación y notificaciones de seguridad) llega firmado con Standard
 * Webhooks (`v1,whsec_…` en SEND_EMAIL_HOOK_SECRET) y se envía por el binding
 * `EMAIL` de Cloudflare Email Service.
 *
 * Contrato de respuesta que espera GoTrue:
 * - 200 `{}` (application/json) = enviado.
 * - Error: `{ error: { http_code, message } }`. GoTrue solo parsea ese cuerpo
 *   en respuestas 2xx; para fallos usa el status, así que el cuerpo lleva el
 *   mismo formato por consistencia.
 * - 503 + `Retry-After` = GoTrue reintenta el envío (fallos transitorios del
 *   binding o secreto aún no desplegado).
 *
 * Sin sesión ni rate limit de usuario: lo llama GoTrue con firma. El proxy ya
 * excluye `/api` del redirect de idioma. Los logs nunca llevan correos,
 * tokens ni metadatos del usuario.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Redis } from '@upstash/redis';
import { verifySendEmailSignature } from '@/lib/email/hook-signature';
import { planAuthEmails } from '@/lib/email/plan';
import { sendAuthEmails } from '@/lib/email/send';
import { supabaseEnv } from '@/lib/supabase/env';
import { getRedis } from '@/lib/utils/redis';

const MAX_BODY_BYTES = 64 * 1024;
/**
 * TTL de la deduplicación por webhook-id. La firma caduca a los ±5 min del
 * timestamp, así que cualquier replay válido llega dentro de ese margen;
 * 10 min lo cubre con holgura (GoTrue además reintenta con el mismo id).
 */
const HOOK_ID_TTL_SECONDS = 10 * 60;

/** email_action_type que GoTrue puede mandar (internal/mailer/mailer.go). */
const EMAIL_ACTION_TYPES = [
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email',
  'email_change',
  'email_change_current',
  'email_change_new',
  'reauthentication',
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
] as const;

const HookPayloadSchema = z.object({
  user: z.object({
    email: z.string().max(320).optional(),
    new_email: z.string().max(320).optional(),
    user_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  }),
  email_data: z.object({
    token: z.string().max(128),
    token_hash: z.string().max(256),
    redirect_to: z.string().max(2048),
    email_action_type: z.enum(EMAIL_ACTION_TYPES),
    site_url: z.string().max(2048),
    token_new: z.string().max(128),
    token_hash_new: z.string().max(256),
    old_email: z.string().max(320).optional(),
    old_phone: z.string().max(64).optional(),
    provider: z.string().max(64).optional(),
    factor_type: z.string().max(32).optional(),
  }),
});

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function hookError(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json(
    { error: { http_code: status, message } },
    { status, headers: { ...NO_STORE, ...headers } }
  );
}

/**
 * Anti-replay además de la ventana de la firma: quien capture una petición
 * firmada puede reenviarla durante ±5 min y duplicar correos. Con Redis se
 * marca cada webhook-id entregado y las repeticiones responden 200 sin
 * reenviar. Sin Redis (o si falla) se omite: es refuerzo, no prerrequisito.
 */
async function hookAlreadySent(redis: Redis | null, webhookId: string): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.get(`email-hook:${webhookId}`)) !== null;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return hookError(413, 'payload_too_large');
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return hookError(413, 'payload_too_large');
  }

  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error('[send-email] SEND_EMAIL_HOOK_SECRET no configurado');
    return hookError(503, 'email_hook_not_configured', { 'Retry-After': '60' });
  }
  if (!(await verifySendEmailSignature(body, request.headers, secret))) {
    return hookError(401, 'invalid_signature');
  }

  // La firma ya validó que los tres headers existen.
  const webhookId = request.headers.get('webhook-id')!;
  const redis = getRedis();
  if (await hookAlreadySent(redis, webhookId)) {
    return NextResponse.json({}, { headers: NO_STORE });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, 'invalid_json');
  }
  const parsed = HookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return hookError(400, 'invalid_payload');
  }

  let verifyBaseUrl: string;
  try {
    verifyBaseUrl = `${supabaseEnv().url}/auth/v1/verify`;
  } catch {
    console.error('[send-email] falta NEXT_PUBLIC_SUPABASE_URL');
    return hookError(503, 'email_hook_not_configured', { 'Retry-After': '60' });
  }

  const { user, email_data } = parsed.data;
  const plans = planAuthEmails(user, email_data, verifyBaseUrl);
  if ('error' in plans) {
    return hookError(400, plans.error);
  }

  try {
    await sendAuthEmails(plans);
  } catch (error) {
    // Sin marca de entregado: GoTrue reintenta con el mismo webhook-id y la
    // siguiente pasada sí envía.
    // Solo el código del binding (E_*) o el tipo de error: nunca el mensaje,
    // que puede arrastrar direcciones o contenido del correo.
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : 'send_failed';
    console.error(
      `[send-email] fallo al enviar tipo=${email_data.email_action_type} correos=${plans.length} codigo=${code}`
    );
    return hookError(503, 'email_send_failed', { 'Retry-After': '30' });
  }

  // Se marca DESPUÉS de enviar: si esto falla, lo peor es un replay dentro de
  // la ventana que vuelve a enviar (a lo sumo duplicado, nunca correo perdido).
  if (redis) {
    try {
      await redis.set(`email-hook:${webhookId}`, 1, { ex: HOOK_ID_TTL_SECONDS });
    } catch {
      // Si la marca no se guarda, la deduplicación queda inactiva esta vez.
    }
  }

  return NextResponse.json({}, { headers: NO_STORE });
}
