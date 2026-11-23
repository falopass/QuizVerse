import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  eval: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    eval = redisMocks.eval;
  },
}));

const cfMocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: cfMocks.getCloudflareContext,
}));

// El módulo cachea la instancia de Redis: reimportarlo por caso.
async function loadRateLimit() {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  return import('@/lib/utils/rate-limit');
}

async function loadRateLimitWithoutRedis() {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  return import('@/lib/utils/rate-limit');
}

function stubCfBindings(env: Record<string, unknown>) {
  cfMocks.getCloudflareContext.mockReturnValue({ env, cf: undefined, ctx: {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  cfMocks.getCloudflareContext.mockImplementation(() => {
    throw new Error('no cf context');
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('checkRateLimit — Redis atómico (Lua eval)', () => {
  it('devuelve un reset real cuando se excede el límite', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    redisMocks.eval.mockResolvedValue([0, 0, 45]);

    const { checkRateLimit, isRateLimitUnavailable } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 45 });
    expect(isRateLimitUnavailable(result)).toBe(false);
    expect(redisMocks.eval).toHaveBeenCalledOnce();
    const [script, keys, args] = redisMocks.eval.mock.calls[0];
    expect(String(script)).toContain('ZREMRANGEBYSCORE');
    expect(String(script)).toContain('ZCARD');
    expect(String(script)).toContain('ZADD');
    expect(keys).toEqual(['ratelimit:test']);
    expect(args.slice(0, 5)).toEqual([1_700_000_000, 1_699_999_940, 5, 60, 1]);
  });

  it('permite la subida normal y decrementa remaining en un solo viaje atómico', async () => {
    redisMocks.eval.mockResolvedValue([1, 2, 60]);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 2, reset: 60 });
    expect(redisMocks.eval).toHaveBeenCalledOnce();
  });

  it('concurrencia: N peticiones simultáneas solo consumen hasta el límite exacto', async () => {
    const store = new Map<string, Array<{ member: string; score: number }>>();
    redisMocks.eval.mockImplementation(
      async (
        _script: string,
        keys: string[],
        args: [number, number, number, number, number, string]
      ) => {
        const [key] = keys;
        const [now, windowStart, limit, window, record, member] = args;
        const active = (store.get(key) ?? []).filter((entry) => entry.score > windowStart);
        if (active.length >= limit) {
          store.set(key, active);
          const oldest = active[0]?.score ?? now;
          const reset = Math.min(window, Math.max(1, Math.ceil(oldest) + window - now));
          return [0, 0, reset];
        }
        if (record === 1) {
          active.push({ member, score: now });
          store.set(key, active);
          return [1, limit - active.length, window];
        }
        store.set(key, active);
        return [1, limit - active.length, window];
      }
    );

    const { checkRateLimit } = await loadRateLimit();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit({ key: 'quiz:u1', limit: 3, window: 60 }))
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    const deniedCount = results.filter((r) => !r.allowed && !r.errored).length;
    expect(allowedCount).toBe(3);
    expect(deniedCount).toBe(7);
    expect(store.get('ratelimit:quiz:u1')).toHaveLength(3);
  });

  it('con record: false consulta sin registrar consumo', async () => {
    redisMocks.eval.mockResolvedValue([1, 3, 60]);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60, record: false });

    expect(result).toEqual({ allowed: true, remaining: 3, reset: 60 });
    const args = redisMocks.eval.mock.calls[0][2];
    expect(args[4]).toBe(0);
  });

  it('si Redis falla y hay binding CF compatible, cae a Cloudflare antes de fallar cerrado', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    redisMocks.eval.mockRejectedValue(new Error('redis down'));
    cfMocks.limit.mockResolvedValue({ success: true });
    stubCfBindings({ RATE_LIMIT_AUTH: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'auth:signin:x', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 5, reset: 60 });
    expect(cfMocks.limit).toHaveBeenCalledWith({ key: 'ratelimit:auth:signin:x' });
    warnSpy.mockRestore();
  });

  it('si Redis falla en política incompatible con CF (ventana > maxWindow o allowCloudflareFallback: false), falla cerrado con errored', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    redisMocks.eval.mockRejectedValue(new Error('redis down'));
    stubCfBindings({ RATE_LIMIT_GAME: { limit: cfMocks.limit } });

    const { checkRateLimit, isRateLimitUnavailable } = await loadRateLimit();
    const dailyBudget = await checkRateLimit({
      key: 'quiz-generate-user:u1',
      limit: 20,
      window: 86_400,
    });
    const noFallback = await checkRateLimit({
      key: 'quiz-generate-user:u1',
      limit: 10,
      window: 60,
      allowCloudflareFallback: false,
    });

    expect(dailyBudget).toEqual({ allowed: false, remaining: 0, reset: 86_400, errored: true });
    expect(noFallback).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
    expect(isRateLimitUnavailable(dailyBudget)).toBe(true);
    expect(isRateLimitUnavailable(noFallback)).toBe(true);
    expect(cfMocks.limit).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('falla cerrado por defecto cuando Redis lanza error y no hay binding CF', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    redisMocks.eval.mockRejectedValue(new Error('redis down'));

    const { checkRateLimit, isRateLimitUnavailable } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
    expect(isRateLimitUnavailable(result)).toBe(true);
  });

  it("falla abierto con onError: 'open' cuando Redis lanza error y no hay binding CF", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    redisMocks.eval.mockRejectedValue(new Error('redis down'));

    const { checkRateLimit, createRateLimiter, isRateLimitUnavailable } = await loadRateLimit();
    const viaConfig = await checkRateLimit({ key: 'test', limit: 5, window: 60, onError: 'open' });
    const viaLimiter = await createRateLimiter('api', 100, 60, 'open').check('analytics:1.2.3.4');

    for (const result of [viaConfig, viaLimiter]) {
      expect(result.allowed).toBe(true);
      expect(result.errored).toBe(true);
      expect(isRateLimitUnavailable(result)).toBe(false);
    }
    expect(viaConfig.remaining).toBe(5);
    expect(viaConfig.reset).toBe(60);
    expect(viaLimiter.remaining).toBe(100);
  });
});

describe('checkRateLimit con binding de Cloudflare y ausencia de backends', () => {
  it('Upstash tiene prioridad: con Redis sano no se consulta el binding', async () => {
    stubCfBindings({ RATE_LIMIT_AUTH: { limit: cfMocks.limit } });
    redisMocks.eval.mockResolvedValue([1, 4, 60]);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'auth:signin:x', limit: 5, window: 60 });

    expect(result.allowed).toBe(true);
    expect(redisMocks.eval).toHaveBeenCalledOnce();
    expect(cfMocks.limit).not.toHaveBeenCalled();
  });

  it('sin Redis consulta el namespace que corresponde a la política', async () => {
    cfMocks.limit.mockResolvedValue({ success: true });
    stubCfBindings({
      RATE_LIMIT_AUTH: { limit: cfMocks.limit },
      RATE_LIMIT_GAME: { limit: vi.fn().mockResolvedValue({ success: true }) },
    });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'auth:signin:abc123', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 5, reset: 60 });
    expect(cfMocks.limit).toHaveBeenCalledWith({ key: 'ratelimit:auth:signin:abc123' });
  });

  it('bloquea con cuota agotada (sin errored) cuando limit() devuelve success: false', async () => {
    cfMocks.limit.mockResolvedValue({ success: false });
    stubCfBindings({ RATE_LIMIT_REVEAL: { limit: cfMocks.limit } });

    const { checkRateLimit, isRateLimitUnavailable } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'quiz-reveal:1.2.3.4', limit: 120, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60 });
    expect(isRateLimitUnavailable(result)).toBe(false);
  });

  it('con record: false no consume el contador del binding', async () => {
    cfMocks.limit.mockResolvedValue({ success: true });
    stubCfBindings({ RATE_LIMIT_GAME: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({
      key: 'quiz-generate-user:u1',
      limit: 10,
      window: 60,
      record: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.errored).toBeUndefined();
    expect(cfMocks.limit).not.toHaveBeenCalled();
  });

  it('sin ningún backend (sin Redis ni binding CF) respeta política cerrada por defecto y marca errored', async () => {
    stubCfBindings({});

    const { checkRateLimit, isRateLimitUnavailable } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'auth:signin:x', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
    expect(isRateLimitUnavailable(result)).toBe(true);
  });

  it("sin ningún backend permite cuando onError: 'open' (telemetría / práctica)", async () => {
    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({
      key: 'api:analytics:1.2.3.4',
      limit: 100,
      window: 60,
      onError: 'open',
    });

    expect(result).toEqual({ allowed: true, remaining: 100, reset: 60, errored: true });
  });

  it('fuera de Workers (getCloudflareContext lanza) cierra por defecto y marca errored', async () => {
    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'quiz:u1', limit: 10, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
  });

  it('la política social consume su propio namespace (20/min)', async () => {
    cfMocks.limit.mockResolvedValue({ success: true });
    stubCfBindings({ RATE_LIMIT_FOLLOW: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'social:follow:u1', limit: 20, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 20, reset: 60 });
    expect(cfMocks.limit).toHaveBeenCalledWith({ key: 'ratelimit:social:follow:u1' });
  });

  it('política sin namespace mapeado no consulta Cloudflare y falla según onError', async () => {
    stubCfBindings({ RATE_LIMIT_AUTH: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const closed = await checkRateLimit({ key: 'sin-mapeo:x', limit: 5, window: 60 });
    const open = await checkRateLimit({
      key: 'sin-mapeo:x',
      limit: 5,
      window: 60,
      onError: 'open',
    });

    expect(closed).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
    expect(open).toEqual({ allowed: true, remaining: 5, reset: 60, errored: true });
    expect(cfMocks.getCloudflareContext).not.toHaveBeenCalled();
  });

  it('falla cerrado por defecto cuando limit() lanza error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cfMocks.limit.mockRejectedValue(new Error('binding down'));
    stubCfBindings({ RATE_LIMIT_GAME: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'quiz-generate-ip:1.2.3.4', limit: 10, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60, errored: true });
  });

  it("falla abierto con onError: 'open' cuando limit() lanza error", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cfMocks.limit.mockRejectedValue(new Error('binding down'));
    stubCfBindings({ RATE_LIMIT_API: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({
      key: 'api:1.2.3.4',
      limit: 100,
      window: 60,
      onError: 'open',
    });

    expect(result).toEqual({ allowed: true, remaining: 100, reset: 60, errored: true });
  });
});
