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

  it('con record: false no registra consumo ni lo descuenta de remaining', async () => {
    redisMocks.zcard.mockResolvedValue(2);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'test', limit: 5, window: 60, record: false });

    expect(result).toEqual({ allowed: true, remaining: 3, reset: 60 });
    expect(redisMocks.zadd).not.toHaveBeenCalled();
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

describe('checkRateLimit con binding de Cloudflare', () => {
  it('Upstash tiene prioridad: con Redis no se consulta el binding', async () => {
    stubCfBindings({ RATE_LIMIT_AUTH: { limit: cfMocks.limit } });
    // clearAllMocks no limpia implementaciones: hay que volver a resolver.
    redisMocks.zremrangebyscore.mockResolvedValue(undefined);
    redisMocks.zcard.mockResolvedValue(0);

    const { checkRateLimit } = await loadRateLimit();
    const result = await checkRateLimit({ key: 'auth:signin:x', limit: 5, window: 60 });

    expect(result.allowed).toBe(true);
    expect(redisMocks.zcard).toHaveBeenCalledOnce();
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

  it('bloquea cuando limit() devuelve success: false', async () => {
    cfMocks.limit.mockResolvedValue({ success: false });
    stubCfBindings({ RATE_LIMIT_REVEAL: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'quiz-reveal:1.2.3.4', limit: 120, window: 60 });

    expect(result).toEqual({ allowed: false, remaining: 0, reset: 60 });
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

  it('sin binding disponible permite y marca errored (comportamiento previo)', async () => {
    stubCfBindings({}); // contexto CF existe pero el namespace no está desplegado

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'auth:signin:x', limit: 5, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 5, reset: 60, errored: true });
  });

  it('fuera de Workers (getCloudflareContext lanza) permite y marca errored', async () => {
    cfMocks.getCloudflareContext.mockImplementation(() => {
      throw new Error('no cf context');
    });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'quiz:u1', limit: 10, window: 60 });

    expect(result).toEqual({ allowed: true, remaining: 10, reset: 60, errored: true });
  });

  it('política sin namespace mapeado permite y marca errored', async () => {
    stubCfBindings({ RATE_LIMIT_AUTH: { limit: cfMocks.limit } });

    const { checkRateLimit } = await loadRateLimitWithoutRedis();
    const result = await checkRateLimit({ key: 'sin-mapeo:x', limit: 5, window: 60 });

    expect(result.errored).toBe(true);
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
