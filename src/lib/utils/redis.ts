/**
 * Cliente Redis compartido (Upstash REST).
 *
 * Rate limiting y el estado efímero de las partidas usan el mismo cliente: sin
 * `UPSTASH_REDIS_REST_URL`/`TOKEN` devuelve `null` y cada módulo decide su
 * fallback (los limiters usan el binding de Cloudflare o dejan pasar; las
 * partidas guardan estado en memoria).
 */

import { Redis } from '@upstash/redis';

let _redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      '[redis] not configured — rate limiting falls back to the Cloudflare binding; ' +
        'game attempts use in-process state'
    );
    _redis = null;
    return null;
  }

  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch (error) {
    console.error('[redis] Failed to initialize client:', error);
    _redis = null;
    return null;
  }
}
