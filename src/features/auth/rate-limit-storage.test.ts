import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers the Upstash-backed `consume` that better-auth calls ahead of every `/api/auth/*` request.
 * Mocked only at the boundaries: `@upstash/redis` (the network client) and the `server-only` guard
 * (which throws outside a Next.js server build). Env vars are stubbed and the module re-imported per
 * test because the storage is constructed at import time from them.
 */
const queued: string[][] = [];
let execResult: unknown = [1, 1, 60];
let multiThrows = false;

vi.mock('server-only', () => ({}));
vi.mock('@upstash/redis', () => ({
  Redis: class {
    multi() {
      if (multiThrows) throw new Error('upstash down');
      const commands: string[] = [];
      queued.push(commands);
      const tx = {
        incr: (key: string) => (commands.push(`INCR ${key}`), tx),
        expire: (key: string, seconds: number, option: string) => (commands.push(`EXPIRE ${key} ${seconds} ${option}`), tx),
        ttl: (key: string) => (commands.push(`TTL ${key}`), tx),
        exec: async () => execResult,
      };
      return tx;
    }
  },
}));

async function loadStorage() {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  const { upstashRateLimitStorage } = await import('./rate-limit-storage');
  if (!upstashRateLimitStorage) throw new Error('storage should be configured');
  return upstashRateLimitStorage;
}

describe('upstashRateLimitStorage.consume', () => {
  beforeEach(() => {
    queued.length = 0;
    execResult = [1, 1, 60];
    multiThrows = false;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is undefined when Upstash is not configured (better-auth then uses its in-memory store)', async () => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    const { upstashRateLimitStorage } = await import('./rate-limit-storage');
    expect(upstashRateLimitStorage).toBeUndefined();
  });

  it('sends INCR and EXPIRE NX in one atomic transaction, so a key can never be left without a TTL', async () => {
    const storage = await loadStorage();

    await storage.consume('/sign-in/email:1.2.3.4', { window: 10, max: 3 });

    expect(queued).toEqual([['INCR /sign-in/email:1.2.3.4', 'EXPIRE /sign-in/email:1.2.3.4 10 NX', 'TTL /sign-in/email:1.2.3.4']]);
  });

  it('blocks over max with the real remaining TTL as retryAfter', async () => {
    const storage = await loadStorage();
    execResult = [4, 0, 7];

    expect(await storage.consume('k', { window: 10, max: 3 })).toEqual({ allowed: false, retryAfter: 7 });
  });

  it('fails OPEN on a Redis error rather than taking all of auth down', async () => {
    const storage = await loadStorage();
    multiThrows = true;

    expect(await storage.consume('k', { window: 10, max: 3 })).toEqual({ allowed: true, retryAfter: null });
  });
});
