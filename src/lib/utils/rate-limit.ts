import { getRedis } from '@/lib/utils/redis';
import type { Redis } from '@upstash/redis';

/**
 * Binding nativo de Rate Limiting de Workers. La API solo expone ventanas
 * fijas de 10 u 60 s por ubicación de edge y `limit({key}) → {success}`: no
 * permite consultar el contador (no hay "peek") ni saber cuánto queda ni cuándo
 * resetea, y no sustituye un presupuesto global diario.
 */
interface CfRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface CfPolicyMeta {
  binding: string;
  period: 10 | 60;
  /** Ventana máxima (s) compatible con la aproximación por minuto del binding. */
  maxWindow: number;
}

/**
 * Política (baseKey del limiter) → namespace declarado en wrangler.jsonc
 * (`ratelimits`). Los números (limit/period) viven allí; los límites y ventanas
 * del código solo mandan en el backend de Upstash. Las políticas de 10 min
 * (reportes y comentarios) se aproximan explícitamente en `RATE_LIMIT_REPORT`;
 * ventanas más largas (p. ej. presupuesto diario) no caen a Cloudflare.
 */
const CF_POLICIES: Record<string, CfPolicyMeta> = {
  auth: { binding: 'RATE_LIMIT_AUTH', period: 60, maxWindow: 60 },
  'auth-ip': { binding: 'RATE_LIMIT_AUTH_IP', period: 60, maxWindow: 60 },
  quiz: { binding: 'RATE_LIMIT_GAME', period: 60, maxWindow: 60 },
  'quiz-generate-ip': { binding: 'RATE_LIMIT_GAME', period: 60, maxWindow: 60 },
  'quiz-generate-user': { binding: 'RATE_LIMIT_GAME', period: 60, maxWindow: 60 },
  'quiz-reveal': { binding: 'RATE_LIMIT_REVEAL', period: 60, maxWindow: 60 },
  'quiz-attempt': { binding: 'RATE_LIMIT_SOCIAL', period: 60, maxWindow: 60 },
  api: { binding: 'RATE_LIMIT_API', period: 60, maxWindow: 60 },
  social: { binding: 'RATE_LIMIT_FOLLOW', period: 60, maxWindow: 60 },
  'quiz-share': { binding: 'RATE_LIMIT_SOCIAL', period: 60, maxWindow: 60 },
  'quiz-group': { binding: 'RATE_LIMIT_SOCIAL', period: 60, maxWindow: 60 },
  'quiz-group-read': { binding: 'RATE_LIMIT_API', period: 60, maxWindow: 60 },
  'quiz-report': { binding: 'RATE_LIMIT_REPORT', period: 60, maxWindow: 600 },
  'quiz-comment': { binding: 'RATE_LIMIT_REPORT', period: 60, maxWindow: 600 },
  'comment-report': { binding: 'RATE_LIMIT_REPORT', period: 60, maxWindow: 600 },
  'csp-report': { binding: 'RATE_LIMIT_CSP', period: 60, maxWindow: 60 },
};

/**
 * Consumo atómico en ventana deslizante (ZSET) en un solo viaje a Redis.
 *
 * KEYS[1]: clave del limiter (`ratelimit:<policy>:<id>`)
 * ARGV[1]: now (segundos Unix)
 * ARGV[2]: windowStart (`now - window`)
 * ARGV[3]: limit
 * ARGV[4]: window (segundos)
 * ARGV[5]: record (1 = consume, 0 = solo consulta)
 * ARGV[6]: member único del evento
 *
 * Devuelve `{ allowed (0|1), remaining, reset }`.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local window = tonumber(ARGV[4])
local record = tonumber(ARGV[5])
local member = ARGV[6]

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestScore = oldest[2] and tonumber(oldest[2]) or nil
  local reset = window
  if oldestScore ~= nil then
    local candidate = math.ceil(oldestScore) + window - now
    if candidate < 1 then
      reset = 1
    elseif candidate > window then
      reset = window
    else
      reset = candidate
    end
  end
  return {0, 0, reset}
end

if record == 1 then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, window)
  return {1, limit - count - 1, window}
end

return {1, limit - count, window}
`;

export interface RateLimitConfig {
  key: string;
  limit: number;
  window: number; // seconds
  /** 'closed' (default) bloquea si el backend falla o falta; 'open' deja pasar (limiters no críticos). */
  onError?: 'closed' | 'open';
  /** false = solo consulta el contador sin registrar consumo (peek antes de decidir). */
  record?: boolean;
  /**
   * false desactiva el fallback al binding de Cloudflare (para políticas que
   * exigen estado global duradero en Upstash). Por defecto depende de
   * `CF_POLICIES` y de que la ventana sea compatible.
   */
  allowCloudflareFallback?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  /** True when the check itself failed (e.g. Redis down or no backend), not a real throttle. */
  errored?: boolean;
}

/** True cuando la denegación viene de indisponibilidad de backend (503) y no de cuota real (429). */
export function isRateLimitUnavailable(
  result: Pick<RateLimitResult, 'allowed' | 'errored'>
): boolean {
  return result.errored === true && !result.allowed;
}

function uniqueMember(now: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${now}-${crypto.randomUUID()}`;
  }
  return `${now}-${Math.random().toString(36).slice(2)}`;
}

function backendFailureResult(config: RateLimitConfig, reset = config.window): RateLimitResult {
  if (config.onError === 'open') {
    return { allowed: true, remaining: config.limit, reset, errored: true };
  }
  return { allowed: false, remaining: 0, reset, errored: true };
}

function cfPolicyFor(config: RateLimitConfig): CfPolicyMeta | null {
  if (config.allowCloudflareFallback === false) return null;
  const baseKey = config.key.split(':', 1)[0];
  const policy = CF_POLICIES[baseKey];
  if (!policy) return null;
  if (config.window > policy.maxWindow) return null;
  return policy;
}

async function getCfLimiter(
  config: RateLimitConfig
): Promise<{ limiter: CfRateLimitBinding; period: number } | null> {
  const policy = cfPolicyFor(config);
  if (!policy) return null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as unknown as Record<
      string,
      CfRateLimitBinding | undefined
    >;
    const limiter = env[policy.binding];
    return limiter ? { limiter, period: policy.period } : null;
  } catch {
    // Fuera de Workers (tests, next dev/build, node): no hay contexto CF.
    return null;
  }
}

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) return checkWithRedis(config, redis);

  const cf = await getCfLimiter(config);
  if (cf) return checkWithCloudflare(config, cf.limiter, cf.period);

  // Sin ningún backend operativo: respeta explícitamente onError ('open' deja
  // pasar telemetría/práctica; 'closed' por defecto bloquea marcando errored
  // para distinguir 503 de un 429 real).
  return backendFailureResult(config);
}

async function checkWithCloudflare(
  config: RateLimitConfig,
  limiter: CfRateLimitBinding,
  period: number
): Promise<RateLimitResult> {
  if (config.record === false) {
    // CF no puede consultar sin consumir: se reporta capacidad y el llamante
    // vuelve a chequear (ahí sí se aplica el límite) al registrar.
    return { allowed: true, remaining: config.limit, reset: period };
  }

  try {
    const { success } = await limiter.limit({ key: `ratelimit:${config.key}` });
    // CF no expone el contador real: remaining solo distingue "pasó" de "no".
    return {
      allowed: success,
      remaining: success ? config.limit : 0,
      reset: period,
    };
  } catch (error) {
    if (config.onError === 'open') {
      console.error('[rate-limit] Cloudflare binding error, failing open:', error);
    } else {
      console.error('[rate-limit] Cloudflare binding error, failing closed:', error);
    }
    return backendFailureResult(config, period);
  }
}

async function checkWithRedis(config: RateLimitConfig, redis: Redis): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;
  const key = `ratelimit:${config.key}`;
  const recordFlag = config.record === false ? 0 : 1;

  try {
    const raw = await redis.eval<
      [number, number, number, number, number, string],
      [number, number, number]
    >(
      SLIDING_WINDOW_LUA,
      [key],
      [now, windowStart, config.limit, config.window, recordFlag, uniqueMember(now)]
    );

    if (!Array.isArray(raw) || raw.length < 3) {
      throw new Error('Malformed Redis rate-limit script response');
    }

    const allowed = Number(raw[0]) === 1;
    const remaining = Math.max(0, Math.floor(Number(raw[1])));
    const rawReset = Number(raw[2]);
    const reset = Number.isFinite(rawReset)
      ? Math.min(config.window, Math.max(1, Math.ceil(rawReset)))
      : config.window;

    return { allowed, remaining, reset };
  } catch (error) {
    // Si Redis cae pero la política admite el binding de Cloudflare y está
    // presente en el Worker, degradamos al binding antes de fallar cerrado/abierto.
    const cf = await getCfLimiter(config);
    if (cf) {
      console.warn('[rate-limit] Redis error, falling back to Cloudflare binding:', error);
      return checkWithCloudflare(config, cf.limiter, cf.period);
    }

    if (config.onError === 'open') {
      console.error('[rate-limit] Redis error, failing open:', error);
    } else {
      console.error('[rate-limit] Redis error, failing closed:', error);
    }
    return backendFailureResult(config);
  }
}

export function createRateLimiter(
  baseKey: string,
  limit: number,
  window: number,
  onError?: 'closed' | 'open',
  options?: { allowCloudflareFallback?: boolean }
) {
  return {
    check: (identifier: string, opts?: { record?: boolean }) =>
      checkRateLimit({
        key: `${baseKey}:${identifier}`,
        limit,
        window,
        onError,
        record: opts?.record,
        allowCloudflareFallback: options?.allowCloudflareFallback,
      }),
  };
}

export const apiLimiter = createRateLimiter('api', 100, 60);
/** Follow/unfollow: 20/min por usuario. Frena bucles que spamean al seguido. */
export const socialLimiter = createRateLimiter('social', 20, 60);
export const quizLimiter = createRateLimiter('quiz', 10, 60);
export const authLimiter = createRateLimiter('auth', 5, 60);
/** Techo por IP para las acciones de auth: el límite por email no frena sprays. */
export const authIpLimiter = createRateLimiter('auth-ip', 30, 60);

export default checkRateLimit;
