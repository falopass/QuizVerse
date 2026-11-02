/**
 * Partida efímera firmada.
 *
 * El reveal entrega la respuesta correcta de una pregunta, así que necesita
 * saber que quien pregunta está jugando una partida concreta. Al empezar cada
 * partida el servidor emite un token HMAC con `quizId`, un `attemptId` y su
 * caducidad; sin token válido no hay veredicto.
 *
 * El token no necesita tabla: la firma impide fabricarlo o cambiar el quiz, y
 * el estado de qué preguntas ya se revelaron vive en `attempt-store` (Redis o,
 * si no hay Redis, memoria del proceso).
 *
 * Secreto: `QUIZ_ATTEMPT_SECRET`; si no está, se deriva de
 * `SUPABASE_SERVICE_ROLE_KEY` para que el juego siga funcionando sin configurar
 * nada nuevo. Sin ninguna de las dos, `createQuizAttempt` devuelve `null` y el
 * reveal falla cerrado (503): la partida sigue jugable y se puntúa al enviar,
 * pero sin feedback inmediato.
 */

import 'server-only';

const TOKEN_VERSION = 'v1';
/** Mismo techo que `MAX_TOTAL_SECONDS` más margen para terminar de enviar. */
export const ATTEMPT_TTL_SECONDS = 3 * 60 * 60;

export interface QuizAttempt {
  quizId: string;
  attemptId: string;
  /** Segundos epoch. */
  issuedAt: number;
  /** Segundos epoch. */
  expiresAt: number;
}

export type AttemptFailureReason =
  | 'unavailable'
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'quiz_mismatch';

export type AttemptVerification =
  | { ok: true; attempt: QuizAttempt }
  | { ok: false; reason: AttemptFailureReason };

function secretMaterial(): string | null {
  const explicit = process.env.QUIZ_ATTEMPT_SECRET;
  if (explicit) return explicit;

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fallback ? `quiz-attempt:v1:${fallback}` : null;
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

function isAttemptPayload(value: unknown): value is {
  q: string;
  a: string;
  iat: number;
  exp: number;
} {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.q === 'string' &&
    typeof record.a === 'string' &&
    Number.isInteger(record.iat) &&
    Number.isInteger(record.exp)
  );
}

/** Emite un attempt para un quiz, o `null` si no hay secreto configurado. */
export async function createQuizAttempt(
  quizId: string,
  now = Date.now()
): Promise<{ token: string; attempt: QuizAttempt } | null> {
  const key = hmacKey();
  if (!key) return null;

  const issuedAt = Math.floor(now / 1000);
  const attempt: QuizAttempt = {
    quizId,
    attemptId: crypto.randomUUID(),
    issuedAt,
    expiresAt: issuedAt + ATTEMPT_TTL_SECONDS,
  };

  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        q: attempt.quizId,
        a: attempt.attemptId,
        iat: issuedAt,
        exp: attempt.expiresAt,
      })
    )
  );
  const signingInput = `${TOKEN_VERSION}.${payload}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await key,
    new TextEncoder().encode(signingInput)
  );

  return { token: `${signingInput}.${toBase64Url(new Uint8Array(signature))}`, attempt };
}

/** Verifica firma, caducidad y pertenencia al quiz. */
export async function verifyQuizAttempt(
  token: string | null | undefined,
  quizId: string,
  now = Date.now()
): Promise<AttemptVerification> {
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
  if (!isAttemptPayload(parsed)) return { ok: false, reason: 'malformed' };

  const attempt: QuizAttempt = {
    quizId: parsed.q,
    attemptId: parsed.a,
    issuedAt: parsed.iat,
    expiresAt: parsed.exp,
  };

  if (attempt.expiresAt * 1000 <= now) return { ok: false, reason: 'expired' };
  if (attempt.quizId !== quizId) return { ok: false, reason: 'quiz_mismatch' };

  return { ok: true, attempt };
}

/**
 * Id y share token deterministas a partir del attemptId.
 *
 * Un reintento del envío no puede leer su propia fila (la RLS de `game_sessions`
 * no deja ver las anónimas), así que necesita reconstruir la misma sesión sin
 * consultar. Derivarlos del attemptId — que el cliente no puede fabricar —
 * mantiene la idempotencia incluso antes de aplicar la migración 019.
 */
export async function sessionIdsForAttempt(
  attemptId: string
): Promise<{ id: string; shareToken: string } | null> {
  const key = hmacKey();
  if (!key) return null;

  const digest = async (label: string) =>
    new Uint8Array(
      await crypto.subtle.sign('HMAC', await key, new TextEncoder().encode(`${label}:${attemptId}`))
    );

  const idBytes = (await digest('game-session-id')).slice(0, 16);
  idBytes[6] = (idBytes[6] & 0x0f) | 0x40;
  idBytes[8] = (idBytes[8] & 0x3f) | 0x80;
  const hex = [...idBytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  const shareToken = [...(await digest('game-session-share')).slice(0, 8)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return { id, shareToken };
}
