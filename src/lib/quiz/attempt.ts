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
 * nada nuevo. Sin ninguna de las dos el módulo entra en modo degradado:
 * `createQuizAttempt` devuelve `null` y el reveal responde como antes de los
 * attempts (sin atar a partida), con un aviso único en logs por instancia.
 */

import 'server-only';

const TOKEN_VERSION = 'v1';
/** Mismo techo que `MAX_TOTAL_SECONDS` más margen para terminar de enviar. */
export const ATTEMPT_TTL_SECONDS = 3 * 60 * 60;
const ALLOWED_VARIANTS = ['normal', 'timed', 'survival', 'practice', 'daily'] as const;

export type QuizAttemptVariant = (typeof ALLOWED_VARIANTS)[number];

export interface QuizAttemptScope {
  /** Usuario autenticado dueño del intento, o `null` cuando se inicia anónimo. */
  userId?: string | null;
  /** Huella/identificador de sesión anónima sin PII cuando `userId` es `null`. */
  anonId?: string | null;
  /** Modalidad o flujo para el que se emitió el intento. */
  variant?: QuizAttemptVariant;
  /** Conjunto ordenado de IDs de preguntas autorizadas para este intento. */
  questionIds?: string[];
  /** Día editorial `YYYY-MM-DD` (America/Santiago) cuando `variant = 'daily'`. */
  dayKey?: string | null;
}

export interface VerifyQuizAttemptScope extends QuizAttemptScope {
  /** Pregunta individual que se intenta revelar o consultar. */
  questionId?: string;
  /** Variantes aceptadas por el endpoint/acción que verifica el intento. */
  allowedVariants?: readonly QuizAttemptVariant[];
  /** Días editoriales aceptados (p. ej. hoy y ayer en cruce de medianoche). */
  allowedDayKeys?: readonly string[];
}

export interface QuizAttempt {
  quizId: string;
  attemptId: string;
  /** Segundos epoch. */
  issuedAt: number;
  /** Segundos epoch. */
  expiresAt: number;
  userId?: string | null;
  anonId?: string | null;
  variant?: QuizAttemptVariant;
  questionIds?: string[];
  dayKey?: string | null;
}

export type AttemptFailureReason =
  | 'unavailable'
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'quiz_mismatch'
  | 'scope_mismatch';

export type AttemptVerification =
  | { ok: true; attempt: QuizAttempt }
  | { ok: false; reason: AttemptFailureReason };

function secretMaterial(): string | null {
  const explicit = process.env.QUIZ_ATTEMPT_SECRET;
  if (explicit) return explicit;

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fallback ? `quiz-attempt:v1:${fallback}` : null;
}

/**
 * Si hay secreto, el reveal y el envío exigen attempt. Sin secreto el juego
 * queda en modo degradado: el reveal responde sin atar a partida (como antes
 * de los attempts) y el envío conserva el comportamiento anterior.
 */
export function attemptsAvailable(): boolean {
  return secretMaterial() !== null;
}

let inactiveWarned = false;

/**
 * Aviso una sola vez por instancia cuando el anti-trampa está inactivo por
 * falta de secreto. Lo llaman los puntos de entrada que degradan (reveal,
 * inicio y envío de partida) para que el modo silencioso no pase desapercibido.
 */
export function warnAttemptsInactive(): void {
  if (inactiveWarned) return;
  inactiveWarned = true;
  console.warn(
    '[quiz] anti-trampa inactivo: falta QUIZ_ATTEMPT_SECRET o ' +
      'SUPABASE_SERVICE_ROLE_KEY; el reveal y el envío responden en modo degradado'
  );
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

interface SignedAttemptPayload {
  q: string;
  a: string;
  iat: number;
  exp: number;
  u?: string | null;
  an?: string | null;
  v?: QuizAttemptVariant;
  qs?: string[];
  d?: string | null;
}

function isVariant(value: unknown): value is QuizAttemptVariant {
  return typeof value === 'string' && (ALLOWED_VARIANTS as readonly string[]).includes(value);
}

function isAttemptPayload(value: unknown): value is SignedAttemptPayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.q !== 'string' ||
    typeof record.a !== 'string' ||
    !Number.isInteger(record.iat) ||
    !Number.isInteger(record.exp)
  ) {
    return false;
  }
  if (record.u !== undefined && record.u !== null && typeof record.u !== 'string') return false;
  if (record.an !== undefined && record.an !== null && typeof record.an !== 'string') return false;
  if (record.v !== undefined && !isVariant(record.v)) return false;
  if (
    record.qs !== undefined &&
    (!Array.isArray(record.qs) ||
      record.qs.some((item) => typeof item !== 'string' || item.length === 0))
  ) {
    return false;
  }
  if (record.d !== undefined && record.d !== null && typeof record.d !== 'string') return false;
  return true;
}

function matchesExpectedScope(attempt: QuizAttempt, expected?: VerifyQuizAttemptScope): boolean {
  if (!expected) return true;

  if (attempt.userId !== undefined && expected.userId !== undefined) {
    if (attempt.userId !== expected.userId) return false;
  }

  if (
    (attempt.userId === null || attempt.userId === undefined) &&
    attempt.anonId &&
    expected.anonId &&
    attempt.anonId !== 'unknown' &&
    expected.anonId !== 'unknown'
  ) {
    if (attempt.anonId !== expected.anonId) return false;
  }

  if (attempt.variant !== undefined) {
    if (expected.variant !== undefined && attempt.variant !== expected.variant) return false;
    if (expected.allowedVariants && !expected.allowedVariants.includes(attempt.variant)) {
      return false;
    }
  }

  if (attempt.questionIds !== undefined) {
    if (expected.questionId !== undefined && !attempt.questionIds.includes(expected.questionId)) {
      return false;
    }
    if (expected.questionIds !== undefined) {
      if (attempt.questionIds.length !== expected.questionIds.length) return false;
      for (let i = 0; i < attempt.questionIds.length; i += 1) {
        if (attempt.questionIds[i] !== expected.questionIds[i]) return false;
      }
    }
  }

  if (attempt.dayKey !== undefined && attempt.dayKey !== null) {
    if (
      expected.dayKey !== undefined &&
      expected.dayKey !== null &&
      attempt.dayKey !== expected.dayKey
    ) {
      return false;
    }
    if (expected.allowedDayKeys && !expected.allowedDayKeys.includes(attempt.dayKey)) {
      return false;
    }
  }

  return true;
}

/** Emite un attempt para un quiz, o `null` si no hay secreto configurado. */
export async function createQuizAttempt(
  quizId: string,
  nowOrScope: number | (QuizAttemptScope & { now?: number }) = Date.now(),
  maybeScope?: QuizAttemptScope
): Promise<{ token: string; attempt: QuizAttempt } | null> {
  const key = hmacKey();
  if (!key) return null;

  const now = typeof nowOrScope === 'number' ? nowOrScope : (nowOrScope.now ?? Date.now());
  const scope: QuizAttemptScope | undefined =
    typeof nowOrScope === 'number' ? maybeScope : nowOrScope;

  const issuedAt = Math.floor(now / 1000);
  const attempt: QuizAttempt = {
    quizId,
    attemptId: crypto.randomUUID(),
    issuedAt,
    expiresAt: issuedAt + ATTEMPT_TTL_SECONDS,
    ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    ...(scope?.anonId !== undefined ? { anonId: scope.anonId } : {}),
    ...(scope?.variant !== undefined ? { variant: scope.variant } : {}),
    ...(scope?.questionIds !== undefined ? { questionIds: [...scope.questionIds] } : {}),
    ...(scope?.dayKey !== undefined ? { dayKey: scope.dayKey } : {}),
  };

  const rawPayload: SignedAttemptPayload = {
    q: attempt.quizId,
    a: attempt.attemptId,
    iat: issuedAt,
    exp: attempt.expiresAt,
    ...(scope?.userId !== undefined ? { u: scope.userId } : {}),
    ...(scope?.anonId !== undefined ? { an: scope.anonId } : {}),
    ...(scope?.variant !== undefined ? { v: scope.variant } : {}),
    ...(scope?.questionIds !== undefined ? { qs: [...scope.questionIds] } : {}),
    ...(scope?.dayKey !== undefined ? { d: scope.dayKey } : {}),
  };

  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(rawPayload)));
  const signingInput = `${TOKEN_VERSION}.${payload}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await key,
    new TextEncoder().encode(signingInput)
  );

  return { token: `${signingInput}.${toBase64Url(new Uint8Array(signature))}`, attempt };
}

/** Verifica firma, caducidad, pertenencia al quiz y ámbito autorizado. */
export async function verifyQuizAttempt(
  token: string | null | undefined,
  quizId: string,
  nowOrScope: number | (VerifyQuizAttemptScope & { now?: number }) = Date.now(),
  maybeScope?: VerifyQuizAttemptScope
): Promise<AttemptVerification> {
  if (!token) return { ok: false, reason: 'missing' };

  const key = hmacKey();
  if (!key) return { ok: false, reason: 'unavailable' };

  const now = typeof nowOrScope === 'number' ? nowOrScope : (nowOrScope.now ?? Date.now());
  const expectedScope: VerifyQuizAttemptScope | undefined =
    typeof nowOrScope === 'number' ? maybeScope : nowOrScope;

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
    ...(parsed.u !== undefined ? { userId: parsed.u } : {}),
    ...(parsed.an !== undefined ? { anonId: parsed.an } : {}),
    ...(parsed.v !== undefined ? { variant: parsed.v } : {}),
    ...(parsed.qs !== undefined ? { questionIds: parsed.qs } : {}),
    ...(parsed.d !== undefined ? { dayKey: parsed.d } : {}),
  };

  if (attempt.expiresAt * 1000 <= now) return { ok: false, reason: 'expired' };
  if (attempt.quizId !== quizId) return { ok: false, reason: 'quiz_mismatch' };
  if (!matchesExpectedScope(attempt, expectedScope)) {
    return { ok: false, reason: 'scope_mismatch' };
  }

  return { ok: true, attempt };
}

/**
 * Tiempo competitivo autoritativo en segundos a partir del reloj del servidor.
 *
 * Cuando el intento firmado proviene del servidor (`expiresAt - issuedAt === ATTEMPT_TTL_SECONDS`)
 * y el tiempo transcurrido es positivo dentro de la ventana de vida, el servidor
 * usa su propia medición (`now - issuedAt`) para que ningún cliente pueda
 * declarar 0–1 s y ganar desempates de grupo.
 */
export function computeAuthoritativeTimeSeconds(
  clientSeconds: number,
  attempt: Pick<QuizAttempt, 'issuedAt' | 'expiresAt'> | null,
  nowMs = Date.now(),
  maxSeconds = 2 * 60 * 60
): number {
  const sanitizedClient = Math.min(maxSeconds, Math.max(0, Math.trunc(clientSeconds || 0)));
  if (!attempt || !Number.isInteger(attempt.issuedAt) || !Number.isInteger(attempt.expiresAt)) {
    return sanitizedClient;
  }
  if (attempt.expiresAt - attempt.issuedAt !== ATTEMPT_TTL_SECONDS) {
    return sanitizedClient;
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  const elapsed = nowSeconds - attempt.issuedAt;
  if (elapsed < 0 || elapsed > ATTEMPT_TTL_SECONDS) {
    return sanitizedClient;
  }
  if (elapsed === 0) {
    return sanitizedClient;
  }
  return Math.min(maxSeconds, elapsed);
}

/**
 * Id y share token deterministas a partir del attemptId.
 *
 * Un reintento del envío no puede leer su propia fila (la RLS de `game_sessions`
 * no deja ver las anónimas), así que necesita reconstruir la misma sesión sin
 * consultar. Derivarlos del attemptId — que el cliente no puede fabricar —
 * mantiene la idempotencia incluso antes de aplicar la migración 020.
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
