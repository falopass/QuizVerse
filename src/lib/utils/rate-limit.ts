import { getRedis } from '@/lib/utils/redis';
import type { Redis } from '@upstash/redis';

/**
 * Binding nativo de Rate Limiting de Workers. La API solo expone ventanas
 * fijas de 10 u 60 s y `limit({key}) → {success}`: no permite consultar el
 * contador (no hay "peek") ni saber cuánto queda ni cuándo resetea.
 */
interface CfRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Política (baseKey del limiter) → namespace declarado en wrangler.jsonc
 * (`ratelimits`). Los números (limit/period) viven allí; los límites y ventanas
 * del código solo mandan en el backend de Upstash. Las políticas con ventana de
 * 10 min caen en el namespace ~1/min.
 */
const CF_BINDINGS: Record<string, string> = {
  auth: 'RATE_LIMIT_AUTH', // 5/60: signin, signup, resend, forgot, pwreset, delete-account
  'auth-ip': 'RATE_LIMIT_AUTH_IP', // 30/60: techo anti-spray por IP
  quiz: 'RATE_LIMIT_GAME', // 10/60: crear quiz
  'quiz-generate-ip': 'RATE_LIMIT_GAME', // 10/60: generación IA por IP
  'quiz-generate-user': 'RATE_LIMIT_GAME', // 10/60: generación IA por usuario
  'quiz-reveal': 'RATE_LIMIT_REVEAL', // 120/60 por IP
  'quiz-attempt': 'RATE_LIMIT_SOCIAL', // 30/60 por IP: arranque de partida
  api: 'RATE_LIMIT_API', // 100/60: monitor, analytics, perfil, likes
  social: 'RATE_LIMIT_FOLLOW', // 20/60: seguir/dejar de seguir, por usuario
  'quiz-share': 'RATE_LIMIT_SOCIAL', // 30/60 por IP
  'quiz-group': 'RATE_LIMIT_SOCIAL', // 20/60 por IP: grupos de ranking
  'quiz-group-read': 'RATE_LIMIT_SOCIAL', // 60/60 por IP: lectura del ranking
  'quiz-report': 'RATE_LIMIT_REPORT', // 8/600 ≈ 1/60
  'quiz-comment': 'RATE_LIMIT_REPORT', // 5/600 ≈ 1/60
  'comment-report': 'RATE_LIMIT_REPORT',
  'csp-report': 'RATE_LIMIT_CSP', // 60/60 por IP
};

const CF_PERIOD_SECONDS = 60;

async function getCfLimiter(key: string): Promise<CfRateLimitBinding | null> {
  const bindingName = CF_BINDINGS[key.split(':', 1)[0]];
  if (!bindingName) return null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as unknown as Record<
      string,
      CfRateLimitBinding | undefined
    >;
    return env[bindingName] ?? null;
  } catch {
    // Fuera de Workers (tests, next dev/build, node): no hay contexto CF.
    return null;
  }
}

export interface RateLimitConfig {
  key: string;
  limit: number;
  window: number; // seconds
  /** 'closed' (default) bloquea si Redis falla; 'open' deja pasar (limiters no críticos). */
  onError?: 'closed' | 'open';
  /** false = solo consulta el contador sin registrar consumo (peek antes de decidir). */
  record?: boolean;
}

export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
  /** True when the check itself failed (e.g. Redis down), not a real throttle. */
  errored?: boolean;
}> {
  const redis = getRedis();
  if (redis) return checkWithRedis(config, redis);

  const cfLimiter = await getCfLimiter(config.key);
  if (cfLimiter) return checkWithCloudflare(config, cfLimiter);

  // shortcut: sin backend el chequeo no ocurrió; se marca errored para que los
  // callers críticos (p. ej. /api/quiz/generate) puedan fallar cerrado.
  return { allowed: true, remaining: config.limit, reset: config.window, errored: true };
}

async function checkWithCloudflare(config: RateLimitConfig, limiter: CfRateLimitBinding) {
  if (config.record === false) {
    // CF no puede consultar sin consumir: se reporta capacidad y el llamante
    // vuelve a chequear (ahí sí se aplica el límite) al registrar.
    return { allowed: true, remaining: config.limit, reset: CF_PERIOD_SECONDS };
  }

  try {
    const { success } = await limiter.limit({ key: `ratelimit:${config.key}` });
    // CF no expone el contador real: remaining solo distingue "pasó" de "no".
    return {
      allowed: success,
      remaining: success ? config.limit : 0,
      reset: CF_PERIOD_SECONDS,
    };
  } catch (error) {
    if (config.onError === 'open') {
      console.error('[rate-limit] Cloudflare binding error, failing open:', error);
      return { allowed: true, remaining: config.limit, reset: CF_PERIOD_SECONDS, errored: true };
    }
    console.error('[rate-limit] Cloudflare binding error, failing closed:', error);
    return { allowed: false, remaining: 0, reset: CF_PERIOD_SECONDS, errored: true };
  }
}

async function checkWithRedis(config: RateLimitConfig, redis: Redis) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;
  const key = `ratelimit:${config.key}`;

  try {
    await redis.zremrangebyscore(key, 0, windowStart);

    const count = await redis.zcard(key);

    if (count >= config.limit) {
      const oldestEntry = await redis.zrange<(string | number)[]>(key, 0, 0, {
        withScores: true,
      });
      // zrange con withScores devuelve una lista plana [member, score, ...]: el score va en [1].
      const oldestScore = Number(oldestEntry?.[1]);
      const reset = Number.isFinite(oldestScore)
        ? Math.min(config.window, Math.max(1, Math.ceil(oldestScore) + config.window - now))
        : config.window;

      return {
        allowed: false,
        remaining: 0,
        reset,
      };
    }

    if (config.record !== false) {
      await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
      await redis.expire(key, config.window);
    }

    return {
      allowed: true,
      remaining: config.limit - count - (config.record === false ? 0 : 1),
      reset: config.window,
    };
  } catch (error) {
    if (config.onError === 'open') {
      console.error('[rate-limit] Redis error, failing open:', error);
      return { allowed: true, remaining: config.limit, reset: config.window, errored: true };
    }
    console.error('[rate-limit] Redis error, failing closed:', error);
    return { allowed: false, remaining: 0, reset: config.window, errored: true };
  }
}

export function createRateLimiter(
  baseKey: string,
  limit: number,
  window: number,
  onError?: 'closed' | 'open'
) {
  return {
    check: (identifier: string, opts?: { record?: boolean }) =>
      checkRateLimit({
        key: `${baseKey}:${identifier}`,
        limit,
        window,
        onError,
        record: opts?.record,
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
