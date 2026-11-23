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
 *   binding, entrega concurrente en curso o secreto aún no desplegado).
 *
 * Endurecimiento (hallazgo A-13):
 * - Lectura acotada del stream en bytes UTF-8 (`MAX_BODY_BYTES = 64 KiB`):
 *   cancela el stream sin acumular en memoria si excede el tope.
 * - Claim durable por mensaje/destinatario en Redis (`sending` con `nx` + TTL
 *   breve → `sent` tras cada envío). Dos entregas concurrentes no duplican, y
 *   un reintento de GoTrue tras fallo parcial en `email_change` (2 destinatarios)
 *   conserva el primer correo marcado como `sent` y solo reenvía el pendiente.
 * - Las claves de Redis usan hash SHA-256 del destinatario; nunca guardan PII.
 * - Ventana residual documentada: el binding `EMAIL` de Cloudflare Email
 *   Service no expone clave de idempotencia del lado del proveedor. Si el
 *   Worker cae o pierde conexión justo entre la aceptación de `binding.send()`
 *   y el `redis.set(..., 'sent')`, tras expirar el claim `sending` (60 s) un
 *   reintento de GoTrue podría emitir un duplicado (entrega at-least-once,
 *   nunca pérdida silenciosa).
 *
 * Sin sesión ni rate limit de usuario: lo llama GoTrue con firma. El proxy ya
 * excluye `/api` del redirect de idioma. Los logs nunca llevan correos,
 * tokens ni metadatos del usuario.
 */
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Redis } from '@upstash/redis';
import { verifySendEmailSignature } from '@/lib/email/hook-signature';
import { planAuthEmails } from '@/lib/email/plan';
import { sendAuthEmail } from '@/lib/email/send';
import { supabaseEnv } from '@/lib/supabase/env';
import { getRedis } from '@/lib/utils/redis';

const MAX_BODY_BYTES = 64 * 1024;
/**
 * TTL de la marca de entrega confirmada por mensaje/destinatario. La firma
 * caduca a los ±5 min del timestamp, así que 10 min cubren toda la ventana de
 * replay y reintentos de GoTrue con el mismo `webhook-id`.
 */
const HOOK_ID_TTL_SECONDS = 10 * 60;
/**
 * TTL del claim en vuelo (`sending`) mientras se ejecuta `binding.send()`.
 * Impide duplicados por entregas concurrentes y se libera automáticamente si
 * el Worker muere antes de confirmar o liberar.
 */
const IN_FLIGHT_CLAIM_TTL_SECONDS = 60;

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
 * Lee el cuerpo con tope estricto en bytes UTF-8: cancela el stream en cuanto
 * supera `maxBytes` y devuelve `null` (413) sin retener todo el payload.
 */
async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return null;
  }

  if (!request.body) {
    const text = await request.text();
    return new TextEncoder().encode(text).byteLength <= maxBytes ? text : null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buffer);
}

/** Clave Redis sin PII para cada destinatario dentro de un `webhook-id`. */
function messageDeliveryKey(webhookId: string, recipient: string, index: number): string {
  const digest = createHash('sha256')
    .update(`${webhookId}:${recipient.toLowerCase()}:${index}`)
    .digest('hex')
    .slice(0, 24);
  return `email-hook:${webhookId}:msg:${digest}`;
}

type ClaimOutcome = 'acquired' | 'already_sent' | 'in_progress' | 'degraded';

async function acquireMessageClaim(redis: Redis | null, key: string): Promise<ClaimOutcome> {
  if (!redis) return 'degraded';
  try {
    const claimed = await redis.set(key, 'sending', {
      nx: true,
      ex: IN_FLIGHT_CLAIM_TTL_SECONDS,
    });
    if (claimed !== null) return 'acquired';

    const existing = await redis.get(key);
    if (existing === 'sent' || existing === 1 || existing === '1') {
      return 'already_sent';
    }
    if (existing === 'sending') {
      return 'in_progress';
    }

    // La clave expiró justo entre `set` y `get`: reintentamos una vez el claim.
    const retried = await redis.set(key, 'sending', {
      nx: true,
      ex: IN_FLIGHT_CLAIM_TTL_SECONDS,
    });
    return retried !== null ? 'acquired' : 'in_progress';
  } catch {
    // Redis degradado: nunca bloquear correos de auth por caída del cache.
    return 'degraded';
  }
}

async function markMessageSent(redis: Redis | null, key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, 'sent', { ex: HOOK_ID_TTL_SECONDS });
  } catch {
    // Ventana residual: el correo ya se aceptó en Cloudflare; si Redis falla aquí
    // el claim `sending` caduca en 60 s y un replay podría duplicar (nunca perder).
  }
}

async function releaseMessageClaim(redis: Redis | null, key: string): Promise<void> {
  if (!redis) return;
  try {
    if (typeof redis.del === 'function') {
      await redis.del(key);
    }
  } catch {
    // El claim expira automáticamente en IN_FLIGHT_CLAIM_TTL_SECONDS.
  }
}

export async function POST(request: Request) {
  const body = await readBoundedText(request, MAX_BODY_BYTES);
  if (body === null) {
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

  for (const [index, plan] of plans.entries()) {
    const key = messageDeliveryKey(webhookId, plan.to, index);
    const claim = await acquireMessageClaim(redis, key);
    if (claim === 'already_sent') continue;
    if (claim === 'in_progress') {
      return hookError(503, 'email_delivery_in_progress', { 'Retry-After': '5' });
    }

    try {
      await sendAuthEmail(plan);
    } catch (error) {
      if (claim === 'acquired') {
        await releaseMessageClaim(redis, key);
      }
      // Solo el código del binding (E_*) o el tipo de error: nunca el mensaje,
      // que puede arrastrar direcciones o contenido del correo.
      const code =
        error && typeof error === 'object' && 'code' in error ? String(error.code) : 'send_failed';
      console.error(
        `[send-email] fallo al enviar tipo=${email_data.email_action_type} correo=${index + 1}/${plans.length} codigo=${code}`
      );
      return hookError(503, 'email_send_failed', { 'Retry-After': '30' });
    }

    await markMessageSent(redis, key);
  }

  return NextResponse.json({}, { headers: NO_STORE });
}
