import { describe, expect, it } from 'vitest';
import { consumeFixedWindow, consumeRedisFixedWindow, type RateLimitRedis, type RateLimitRule } from './rate-limit';

/**
 * Tests target the pure `consumeFixedWindow` core (no Redis, no clock, no env) — the algorithm the
 * production `rateLimit` wrapper delegates to on the in-memory path. The wrapper itself is a no-op
 * under `NODE_ENV === 'test'` by design (so route suites aren't throttled), so its branching isn't
 * unit-tested here; the counting logic that matters lives entirely in the core.
 */
const RULE: RateLimitRule = { max: 3, windowSec: 60 };

describe('consumeFixedWindow', () => {
  it('allows requests up to max, then blocks', () => {
    const store = new Map();
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(true); // 1
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(true); // 2
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(true); // 3
    const blocked = consumeFixedWindow(store, 'ip', 0, RULE); // 4 — over budget
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const store = new Map();
    for (let i = 0; i < 3; i++) consumeFixedWindow(store, 'ip', 0, RULE);
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(false);
    // A request past the window start (resetAt) begins a fresh window.
    expect(consumeFixedWindow(store, 'ip', 60_000, RULE).allowed).toBe(true);
  });

  it('keys are independent (one IP hitting the limit does not block another)', () => {
    const store = new Map();
    for (let i = 0; i < 4; i++) consumeFixedWindow(store, 'a', 0, RULE);
    expect(consumeFixedWindow(store, 'a', 0, RULE).allowed).toBe(false);
    expect(consumeFixedWindow(store, 'b', 0, RULE).allowed).toBe(true);
  });

  it('retryAfter is in seconds and at least 1', () => {
    const store = new Map();
    for (let i = 0; i < 3; i++) consumeFixedWindow(store, 'ip', 0, RULE);
    // 500 ms into the window: 59.5 s remain → ceil to 60.
    const r = consumeFixedWindow(store, 'ip', 500, RULE);
    expect(r.retryAfter).toBe(60);
  });
});

/**
 * A stub for the Upstash client at the infrastructure boundary: records every command queued on a
 * `multi()` and how many transactions were executed, and answers `exec` with canned results.
 */
function redisStub(results: [count: number, expireSet: number, ttl: number]) {
  const transactions: string[][] = [];
  const client: RateLimitRedis = {
    multi() {
      const queued: string[] = [];
      transactions.push(queued);
      const tx = {
        incr: (key: string) => (queued.push(`INCR ${key}`), tx),
        expire: (key: string, seconds: number, option: string) => (queued.push(`EXPIRE ${key} ${seconds} ${option}`), tx),
        ttl: (key: string) => (queued.push(`TTL ${key}`), tx),
        exec: async <T,>() => results as unknown as T,
      };
      return tx;
    },
  };
  return { client, transactions };
}

describe('consumeRedisFixedWindow', () => {
  it('issues INCR and EXPIRE NX in the SAME atomic transaction — one round trip, no TTL-less window', async () => {
    const { client, transactions } = redisStub([1, 1, 60]);

    await consumeRedisFixedWindow(client, 'generate:1.2.3.4', 10, 60);

    expect(transactions).toEqual([['INCR generate:1.2.3.4', 'EXPIRE generate:1.2.3.4 60 NX', 'TTL generate:1.2.3.4']]);
  });

  it('still sends EXPIRE NX on later hits (NX makes it a no-op, and heals a key orphaned without a TTL)', async () => {
    const { client, transactions } = redisStub([5, 0, 42]);

    await consumeRedisFixedWindow(client, 'k', 10, 60);

    expect(transactions[0]).toContain('EXPIRE k 60 NX');
  });

  it('allows up to max', async () => {
    const { client } = redisStub([10, 0, 30]);
    expect(await consumeRedisFixedWindow(client, 'k', 10, 60)).toEqual({ allowed: true, retryAfter: null });
  });

  it("over max, retryAfter is the key's real remaining TTL, not the full window", async () => {
    const { client } = redisStub([11, 0, 17]);
    expect(await consumeRedisFixedWindow(client, 'k', 10, 60)).toEqual({ allowed: false, retryAfter: 17 });
  });

  it('falls back to the full window when TTL reports no expiry (-1/-2)', async () => {
    const { client } = redisStub([11, 0, -1]);
    expect(await consumeRedisFixedWindow(client, 'k', 10, 60)).toEqual({ allowed: false, retryAfter: 60 });
  });

  it('propagates a Redis error so each caller applies its own fail-open policy', async () => {
    const client = { multi: () => { throw new Error('upstash down'); } } as unknown as RateLimitRedis;
    await expect(consumeRedisFixedWindow(client, 'k', 10, 60)).rejects.toThrow('upstash down');
  });
});
