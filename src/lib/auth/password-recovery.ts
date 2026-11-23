/**
 * Desafío de recuperación de contraseña firmado y de un solo uso.
 *
 * GoTrue crea una sesión al canjear el enlace de recuperación en `/callback`,
 * pero cualquier sesión ordinaria de la cuenta también supera `getUser()`.
 * Sin esta prueba explícita, una sesión abierta en otro equipo podría llamar a
 * `resetPasswordAction` y cambiar la clave sin revalidar la contraseña actual.
 *
 * Flujo:
 * 1. `/callback` verifica el desafío con GoTrue (`exchangeCodeForSession` con
 *    claim `amr: recovery` en el JWT devuelto por GoTrue, o `verifyOtp` con
 *    `type: 'recovery'`).
 * 2. Emite un token HMAC-SHA256 ligado al `userId`, al `session_id` del JWT
 *    (cuando está presente) y a un `challengeId` único, guardado en cookie
 *    HttpOnly (`qv_pw_recovery`).
 * 3. `/{locale}/reset-password` valida la cookie sin consumirla para decidir si
 *    muestra el formulario o la salida localizada de enlace vencido/inválido.
 * 4. `resetPasswordAction` adquiere un claim atómico (Redis o memoria local en
 *    modo degradado), ejecuta `updateUser`, marca el `challengeId` como usado y
 *    borra la cookie. Reutilizar la cookie o la misma sesión ordinaria falla.
 */

import 'server-only';
import { getRedis } from '@/lib/utils/redis';

const TOKEN_VERSION = 'v1';

/** Cookie HttpOnly con la prueba de recuperación emitida por `/callback`. */
export const RECOVERY_COOKIE_NAME = 'qv_pw_recovery';

/** Vigencia de la prueba tras canjear el enlace de recuperación (15 min). */
export const RECOVERY_CHALLENGE_TTL_SECONDS = 15 * 60;

/** Reserva temporal mientras `updateUser` está en vuelo (evita carrera). */
const RECOVERY_CLAIM_TTL_SECONDS = 60;

/** Tope de entradas en el mapa de fallback en memoria por isolate. */
const MEMORY_STORE_MAX_ENTRIES = 500;

export interface RecoveryChallenge {
  challengeId: string;
  userId: string;
  sessionId: string | null;
  issuedAt: number;
  expiresAt: number;
}

export type RecoveryFailureReason =
  | 'unavailable'
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'user_mismatch'
  | 'session_mismatch'
  | 'consumed'
  | 'in_progress';

export type RecoveryVerification =
  | { ok: true; challenge: RecoveryChallenge }
  | { ok: false; reason: RecoveryFailureReason };

export type RecoveryClaimResult =
  | {
      ok: true;
      challenge: RecoveryChallenge;
      /** Marca el desafío como usado de forma permanente hasta su caducidad. */
      complete: () => Promise<void>;
      /** Libera la reserva en vuelo (solo en errores recuperables como weak_password). */
      release: () => Promise<void>;
    }
  | { ok: false; reason: RecoveryFailureReason };

const RECOVERY_PATH_RE = /^\/(en|es)\/reset-password\/?(\?.*)?$/;

/** Determina si una ruta interna corresponde a la página de recuperación. */
export function isRecoveryPath(path: string | null | undefined): boolean {
  return typeof path === 'string' && RECOVERY_PATH_RE.test(path);
}

/** Opciones de cookie HttpOnly para la prueba de recuperación. */
export function recoveryCookieOptions(maxAge = RECOVERY_CHALLENGE_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

function secretMaterial(): string | null {
  const explicit = process.env.PASSWORD_RECOVERY_SECRET;
  if (explicit) return `password-recovery:v1:${explicit}`;

  const attemptSecret = process.env.QUIZ_ATTEMPT_SECRET;
  if (attemptSecret) return `password-recovery:v1:${attemptSecret}`;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return serviceKey ? `password-recovery:v1:${serviceKey}` : null;
}

export function recoverySigningAvailable(): boolean {
  return secretMaterial() !== null;
}

let cachedKey: { material: string; key: Promise<CryptoKey> } | null = null;

function hmacKey(): Promise<CryptoKey> | null {
  const material = secretMaterial();
  if (!material) return null;

  if (!cachedKey || cachedKey.material !== material) {
    cachedKey = {
      material,
      key: crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(material),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      ),
    };
  }
  return cachedKey.key;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Decodifica el payload de un JWT devuelto por GoTrue en el servidor.
 * Nunca se usa para autenticar un token arbitrario del cliente: solo lee claims
 * (`amr`, `session_id`) de una sesión recién entregada o validada por GoTrue.
 */
export function extractJwtPayload(jwt: string | null | undefined): Record<string, unknown> | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const bytes = fromBase64Url(parts[1]);
  if (!bytes) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Extrae el `session_id` del access token JWT de GoTrue cuando existe. */
export function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  const payload = extractJwtPayload(accessToken);
  const sid = payload?.session_id;
  return typeof sid === 'string' && sid.length > 0 ? sid : null;
}

/**
 * Comprueba que la sesión devuelta por GoTrue tras `exchangeCodeForSession`
 * incluya el método de autenticación `recovery` en el claim `amr`.
 *
 * Rechaza sesiones creadas por OAuth (`method: 'oauth'`), contraseña
 * (`method: 'password'`) o alta (`method: 'signup'`).
 */
export function isRecoverySession(
  session: { access_token?: string | null } | null | undefined
): boolean {
  const payload = extractJwtPayload(session?.access_token);
  const amr = payload?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      (entry as { method?: unknown }).method === 'recovery'
  );
}

interface RecoveryTokenPayload {
  c: string;
  u: string;
  s: string | null;
  iat: number;
  exp: number;
}

function isRecoveryTokenPayload(value: unknown): value is RecoveryTokenPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.c === 'string' &&
    record.c.length > 0 &&
    typeof record.u === 'string' &&
    record.u.length > 0 &&
    (record.s === null || typeof record.s === 'string') &&
    Number.isInteger(record.iat) &&
    Number.isInteger(record.exp)
  );
}

/** Estado local en memoria cuando Upstash Redis no está configurado. */
const memoryState = new Map<string, { status: 'pending' | 'used'; expiresAtMs: number }>();

function pruneMemoryState(now: number): void {
  for (const [key, entry] of memoryState) {
    if (entry.expiresAtMs <= now) memoryState.delete(key);
  }
  while (memoryState.size > MEMORY_STORE_MAX_ENTRIES) {
    const oldest = memoryState.keys().next().value;
    if (!oldest) break;
    memoryState.delete(oldest);
  }
}

export function resetRecoveryMemoryStoreForTests(): void {
  memoryState.clear();
}

function usedKey(challengeId: string): string {
  return `pw-recovery:used:${challengeId}`;
}

function claimKey(challengeId: string): string {
  return `pw-recovery:claim:${challengeId}`;
}

async function isChallengeConsumed(challengeId: string, now: number): Promise<boolean> {
  pruneMemoryState(now);
  const local = memoryState.get(challengeId);
  if (local && local.status === 'used' && local.expiresAtMs > now) return true;

  const redis = getRedis();
  if (!redis) return false;
  try {
    return (await redis.get(usedKey(challengeId))) !== null;
  } catch {
    return false;
  }
}

/** Emite un desafío de recuperación firmado, o `null` si falta secreto. */
export async function createRecoveryChallenge(
  input: { userId: string; sessionId?: string | null },
  now = Date.now()
): Promise<{ token: string; challenge: RecoveryChallenge } | null> {
  const key = hmacKey();
  if (!key) return null;

  const issuedAt = Math.floor(now / 1000);
  const challenge: RecoveryChallenge = {
    challengeId: crypto.randomUUID(),
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    issuedAt,
    expiresAt: issuedAt + RECOVERY_CHALLENGE_TTL_SECONDS,
  };

  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        c: challenge.challengeId,
        u: challenge.userId,
        s: challenge.sessionId,
        iat: challenge.issuedAt,
        exp: challenge.expiresAt,
      } satisfies RecoveryTokenPayload)
    )
  );
  const signingInput = `${TOKEN_VERSION}.${payload}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await key,
    new TextEncoder().encode(signingInput)
  );

  return {
    token: `${signingInput}.${toBase64Url(new Uint8Array(signature))}`,
    challenge,
  };
}

async function verifySignedChallenge(
  token: string | null | undefined,
  expected: { userId: string; sessionId?: string | null },
  now: number
): Promise<RecoveryVerification> {
  if (!token) return { ok: false, reason: 'missing' };

  const key = hmacKey();
  if (!key) return { ok: false, reason: 'unavailable' };

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return { ok: false, reason: 'malformed' };
  }

  const payloadBytes = fromBase64Url(parts[1]);
  const signatureBytes = fromBase64Url(parts[2]);
  if (!payloadBytes || !signatureBytes) return { ok: false, reason: 'malformed' };

  const signed = await crypto.subtle.verify(
    'HMAC',
    await key,
    signatureBytes as unknown as BufferSource,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!signed) return { ok: false, reason: 'bad_signature' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!isRecoveryTokenPayload(parsed)) return { ok: false, reason: 'malformed' };

  const challenge: RecoveryChallenge = {
    challengeId: parsed.c,
    userId: parsed.u,
    sessionId: parsed.s,
    issuedAt: parsed.iat,
    expiresAt: parsed.exp,
  };

  if (challenge.expiresAt * 1000 <= now) return { ok: false, reason: 'expired' };
  if (challenge.userId !== expected.userId) return { ok: false, reason: 'user_mismatch' };
  if (challenge.sessionId && expected.sessionId !== challenge.sessionId) {
    return { ok: false, reason: 'session_mismatch' };
  }

  return { ok: true, challenge };
}

/**
 * Verifica firma, caducidad, usuario, sesión y que no haya sido consumido,
 * sin consumirlo (pensado para el render de `/{locale}/reset-password`).
 */
export async function verifyRecoveryChallenge(
  token: string | null | undefined,
  expected: { userId: string; sessionId?: string | null },
  now = Date.now()
): Promise<RecoveryVerification> {
  const verified = await verifySignedChallenge(token, expected, now);
  if (!verified.ok) return verified;

  if (await isChallengeConsumed(verified.challenge.challengeId, now)) {
    return { ok: false, reason: 'consumed' };
  }

  return verified;
}

/**
 * Verifica y reserva en exclusiva el desafío de recuperación antes de llamar a
 * `updateUser`. Impide el doble uso concurrente y el replay posterior.
 */
export async function beginRecoveryChallengeUse(
  token: string | null | undefined,
  expected: { userId: string; sessionId?: string | null },
  now = Date.now()
): Promise<RecoveryClaimResult> {
  const verified = await verifySignedChallenge(token, expected, now);
  if (!verified.ok) return verified;

  const { challenge } = verified;
  const remainingSeconds = Math.max(
    RECOVERY_CLAIM_TTL_SECONDS,
    Math.ceil((challenge.expiresAt * 1000 - now) / 1000)
  );

  pruneMemoryState(now);
  const existingLocal = memoryState.get(challenge.challengeId);
  if (existingLocal && existingLocal.expiresAtMs > now) {
    return {
      ok: false,
      reason: existingLocal.status === 'used' ? 'consumed' : 'in_progress',
    };
  }

  const redis = getRedis();
  if (redis) {
    try {
      if ((await redis.get(usedKey(challenge.challengeId))) !== null) {
        return { ok: false, reason: 'consumed' };
      }
      const claimed = await redis.set(claimKey(challenge.challengeId), '1', {
        nx: true,
        ex: RECOVERY_CLAIM_TTL_SECONDS,
      });
      if (claimed === null) {
        return { ok: false, reason: 'in_progress' };
      }
    } catch {
      // Sin Redis operativo cae al guard local de este isolate.
    }
  }

  memoryState.set(challenge.challengeId, {
    status: 'pending',
    expiresAtMs: now + RECOVERY_CLAIM_TTL_SECONDS * 1000,
  });

  return {
    ok: true,
    challenge,
    complete: async () => {
      memoryState.set(challenge.challengeId, {
        status: 'used',
        expiresAtMs: Math.max(challenge.expiresAt * 1000, now + RECOVERY_CLAIM_TTL_SECONDS * 1000),
      });
      if (redis) {
        try {
          await redis.set(usedKey(challenge.challengeId), '1', { ex: remainingSeconds });
          await redis.del(claimKey(challenge.challengeId));
        } catch {
          // La cookie igualmente se elimina al responder y memoria local bloquea este isolate.
        }
      }
    },
    release: async () => {
      const current = memoryState.get(challenge.challengeId);
      if (current?.status === 'pending') {
        memoryState.delete(challenge.challengeId);
      }
      if (redis) {
        try {
          await redis.del(claimKey(challenge.challengeId));
        } catch {
          // La reserva caduca sola tras RECOVERY_CLAIM_TTL_SECONDS.
        }
      }
    },
  };
}
