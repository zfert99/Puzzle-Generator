import 'server-only';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

interface StoredRateLimit {
  key: string;
  count: number;
  lastRequest: number;
}

function createUpstashRateLimitStorage(redisUrl: string, redisToken: string) {
  const redis = new Redis({ url: redisUrl, token: redisToken });

  return {
    // Effectively dead code while `consume` (below) is present — better-auth's router only
    // falls back to `get`/`set` when a storage has no `consume`. Implemented anyway to
    // satisfy the `BetterAuthRateLimitStorage` type and as a safety net for any future
    // caller that only knows the legacy get/set contract.
    get: async (key: string) => (await redis.get<StoredRateLimit>(key)) ?? null,
    set: async (key: string, value: StoredRateLimit) => {
      await redis.set(key, value);
    },
    // Atomic INCR + first-write EXPIRE, fail-open on any Redis error.
    //
    // `onRequestRateLimit` runs ahead of EVERY request to /api/auth/* (sign-in, session
    // checks, everything), with no surrounding try/catch in better-auth's router — an
    // unhandled rejection here would turn a transient Upstash blip into a hard outage for
    // all of auth, not just the rate-limited paths. Failing open trades a brief loss of
    // rate-limit coverage (an infra hiccup, not something an external attacker can trigger
    // on demand) for keeping sign-in/session-checks alive — the better trade when auth
    // being down blocks the rest of the app too.
    consume: async (key: string, rule: { window: number; max: number }) => {
      try {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, rule.window);
        return count <= rule.max
          ? { allowed: true, retryAfter: null }
          : { allowed: false, retryAfter: rule.window };
      } catch (err) {
        logger.error({ err, key }, 'Upstash rate-limit check failed; failing open');
        return { allowed: true, retryAfter: null };
      }
    },
  };
}

// `KV_REST_API_URL`/`KV_REST_API_TOKEN` is the fallback naming `@upstash/redis`'s own
// `fromEnv()` checks for — Vercel's "Upstash for Redis" marketplace integration injects
// credentials under those names rather than `UPSTASH_REDIS_REST_*`. Replicated manually
// (instead of calling `fromEnv()` directly) so an unconfigured local dev environment stays
// silent rather than logging fromEnv()'s built-in "unable to find environment variable"
// warnings on every server start.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

/**
 * Rate-limit-ONLY storage for better-auth's `rateLimit.customStorage`. Deliberately NOT
 * wired via the top-level `secondaryStorage` option — see rate-limit-storage.md for why
 * that option is unsafe here (it silently repoints session reads at Redis too, not just
 * rate-limit counters). `undefined` when Upstash isn't configured, so `auth.ts` falls back
 * to better-auth's in-memory rate-limit storage (fine for local dev).
 */
export const upstashRateLimitStorage = url && token ? createUpstashRateLimitStorage(url, token) : undefined;
