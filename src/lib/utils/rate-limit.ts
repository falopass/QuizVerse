import { Redis } from '@upstash/redis';

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[rate-limit] Redis not configured — rate limiting disabled');
    _redis = null;
    return null;
  }

  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch (error) {
    console.error('[rate-limit] Failed to initialize Redis client:', error);
    _redis = null;
    return null;
  }
}

export interface RateLimitConfig {
  key: string;
  limit: number;
  window: number; // seconds
}

export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
  /** True when the check itself failed (e.g. Redis down), not a real throttle. */
  errored?: boolean;
}> {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, remaining: config.limit, reset: config.window };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;
  const key = `ratelimit:${config.key}`;

  try {
    await redis.zremrangebyscore(key, 0, windowStart);

    const count = await redis.zcard(key);

    if (count >= config.limit) {
      const oldestEntry = await redis.zrange<number[]>(key, 0, 0, { withScores: true });
      const oldestScore = oldestEntry?.[0] as unknown as number | undefined;
      const reset = Math.ceil(oldestScore ?? now + config.window) - now + config.window;

      return {
        allowed: false,
        remaining: 0,
        reset,
      };
    }

    await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    await redis.expire(key, config.window);

    return {
      allowed: true,
      remaining: config.limit - count - 1,
      reset: config.window,
    };
  } catch (error) {
    console.error('[rate-limit] Redis error, failing closed:', error);
    return { allowed: false, remaining: 0, reset: config.window, errored: true };
  }
}

export function createRateLimiter(baseKey: string, limit: number, window: number) {
  return {
    check: (identifier: string) =>
      checkRateLimit({
        key: `${baseKey}:${identifier}`,
        limit,
        window,
      }),
  };
}

export const apiLimiter = createRateLimiter('api', 100, 60);
export const quizLimiter = createRateLimiter('quiz', 10, 60);
export const authLimiter = createRateLimiter('auth', 5, 60);

export default checkRateLimit;
