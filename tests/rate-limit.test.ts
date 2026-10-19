import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zrange: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    zremrangebyscore = redisMocks.zremrangebyscore;
    zcard = redisMocks.zcard;
    zrange = redisMocks.zrange;
    zadd = redisMocks.zadd;
    expire = redisMocks.expire;
  },
}));

// El módulo cachea la instancia de Redis: reimportarlo por caso.
async function loadRateLimit() {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  return import('@/lib/utils/rate-limit');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('devuelve un reset real cuando se excede el límite', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const now = Math.floor(Date.now() / 1000);
    redisMocks.zcard.mockResolvedValue(5);
    // zrange withScores devuelve lista plana [member, score, ...]
    redisMocks.zrange.mockResolvedValue([`${now - 15}-0.5`, now - 15]);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(Number.isFinite(result.reset)).toBe(true);
    expect(Number.isInteger(result.reset)).toBe(true);
    expect(result.reset).toBe(45);
    expect(result.reset).toBeGreaterThan(0);
    expect(result.reset).toBeLessThanOrEqual(60);
  });

  it('permite la subida normal y decrementa remaining', async () => {
    redisMocks.zcard.mockResolvedValue(2);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 2, reset: 60 });
    expect(redisMocks.zadd).toHaveBeenCalledOnce();
    expect(redisMocks.expire).toHaveBeenCalledWith('ratelimit:test', 60);
  });

  it('falla cerrado por defecto cuando Redis lanza error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    redisMocks.zremrangebyscore.mockRejectedValue(new Error('redis down'));

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
  });

  it("falla abierto con onError: 'open' cuando Redis lanza error", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    redisMocks.zremrangebyscore.mockRejectedValue(new Error('redis down'));

    const { checkRateLimit, createRateLimiter } = await loadRateLimit();
    const viaConfig = await checkRateLimit({ key: 'test', limit: 5, window: 60, onError: 'open' });
    const viaLimiter = await createRateLimiter('api', 100, 60, 'open').check('analytics:1.2.3.4');

    for (const result of [viaConfig, viaLimiter]) {
      expect(result.allowed).toBe(true);
      expect(result.errored).toBe(true);
    }
    expect(viaConfig.remaining).toBe(5);
    expect(viaConfig.reset).toBe(60);
    expect(viaLimiter.remaining).toBe(100);
  });
});
