// Not marked `server-only`: this module is imported only by API route handlers (never a client
// component), and the `server-only` guard throws under the vitest `node` environment, which would
// break the route handler test suites that import these routes. The Redis client + env reads keep it
// server-side in practice regardless.
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import { logger } from './logger';

/**
 * Per-IP rate limiting for the public, CPU-heavy generation routes (`/api/generate`,
 * `/api/puzzle`). These run the synchronous solver/generator with `maxDuration = 60` and take no
 * auth, so without a throttle anyone can exhaust serverless compute/$ by hammering them (the review's
 * H1 finding). better-auth's own rate limiter only covers `/api/auth/*`, so app routes need this.
 *
 * Fixed-window counter. Backed by Upstash Redis when configured (shared across Vercel's separate
 * serverless instances, same as the auth rate-limit storage), falling back to a per-instance
 * in-memory map when it isn't — the fallback is weaker (each cold-started instance keeps its own
 * counters) but is correct for local dev and strictly better than no limit at all.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying, when `allowed` is false. */
  retryAfter: number | null;
}

export interface RateLimitRule {
  /** Max requests allowed within the window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
}

interface Bucket {
  count: number;
  /** Epoch-ms at which this window resets. */
  resetAt: number;
}

// Cap the in-memory map so a flood of distinct IPs can't grow it without bound; when exceeded we
// drop already-expired buckets first (cheap and correct — an expired bucket resets on next hit).
const MAX_MEMORY_KEYS = 10_000;

/**
 * The pure fixed-window check against a caller-provided store and clock — the unit-testable core,
 * with no Redis, env, or `Date.now()` dependency. `rateLimit` below wraps this for the in-memory path.
 */
export function consumeFixedWindow(
  store: Map<string, Bucket>,
  key: string,
  nowMs: number,
  rule: RateLimitRule,
): RateLimitResult {
  const entry = store.get(key);
  if (!entry || entry.resetAt <= nowMs) {
    if (store.size >= MAX_MEMORY_KEYS) {
      for (const [k, v] of store) if (v.resetAt <= nowMs) store.delete(k);
    }
    store.set(key, { count: 1, resetAt: nowMs + rule.windowSec * 1000 });
    return { allowed: true, retryAfter: null };
  }
  entry.count += 1;
  if (entry.count <= rule.max) return { allowed: true, retryAfter: null };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - nowMs) / 1000)) };
}

// Same env-var fallback the auth rate-limit storage uses — Vercel's Upstash integration injects
// credentials under the `KV_REST_API_*` names rather than `UPSTASH_REDIS_REST_*`.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const memoryStore = new Map<string, Bucket>();

/**
 * Consume one request against `key`'s budget. Returns `{ allowed: false, retryAfter }` when the
 * window is exhausted. Fails **open** on any Redis error (a transient Upstash blip shouldn't take
 * the route down) and is a no-op under test (`NODE_ENV === 'test'`) so the route test suites aren't
 * throttled — the counter logic itself is covered directly via `consumeFixedWindow`.
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === 'test') return { allowed: true, retryAfter: null };

  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, rule.windowSec);
      return count <= rule.max
        ? { allowed: true, retryAfter: null }
        : { allowed: false, retryAfter: rule.windowSec };
    } catch (err) {
      logger.error({ err, key }, 'Rate-limit check failed; failing open');
      return { allowed: true, retryAfter: null };
    }
  }

  return consumeFixedWindow(memoryStore, key, Date.now(), rule);
}

/**
 * Best-effort client IP from the proxy headers Vercel sets. Falls back to `'unknown'` (a single
 * shared bucket) when absent — deliberately conservative: a missing IP shares one budget rather than
 * escaping the limit entirely. Defensive against a header-less request object (e.g. unit-test mocks).
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers?.get?.('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers?.get?.('x-real-ip')?.trim() || 'unknown';
}
