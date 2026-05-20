import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitConfig {
  key: string;
  limit: number;
  window: number; // seconds
}

export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;
  const key = `ratelimit:${config.key}`;

  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count requests in current window
  const count = await redis.zcard(key);

  if (count >= config.limit) {
    const oldestEntry = await redis.zrange<number[]>(key, 0, 0, { withScores: true });
    const reset =
      Math.ceil((oldestEntry[0] as any)?.score ?? now + config.window) + config.window - now;

    return {
      allowed: false,
      remaining: 0,
      reset,
    };
  }

  // Add current request
  await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  await redis.expire(key, config.window);

  return {
    allowed: true,
    remaining: config.limit - count - 1,
    reset: config.window,
  };
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

// Predefined limiters
export const apiLimiter = createRateLimiter('api', 100, 60); // 100 requests per minute
export const quizLimiter = createRateLimiter('quiz', 10, 60); // 10 quizzes per minute
export const authLimiter = createRateLimiter('auth', 5, 60); // 5 auth attempts per minute

export default checkRateLimit;
