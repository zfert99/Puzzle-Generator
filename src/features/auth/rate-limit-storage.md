# Rate-Limit Storage (`rate-limit-storage.ts`)

An Upstash Redis-backed implementation of better-auth's `BetterAuthRateLimitStorage`
contract (`rateLimit.customStorage`), exporting `undefined` when Upstash isn't configured
so [`auth.ts`](./auth.md) can fall back to the library's in-memory default without any
conditional logic of its own.

## Why `customStorage`, not `secondaryStorage`

**Why:** better-auth also exposes a `secondaryStorage` option that *sounds* like the right
tool — it's a general key/value store the library can back rate limiting with. It's the
wrong one here. Setting `secondaryStorage` at all makes better-auth serve session reads
from it **unconditionally** for every authenticated request ("Reads are always done from
the secondary storage" — its own docs; the `storeSessionInDatabase` flag only controls
whether a database copy is *also* kept, not which store is read from). Wiring that up to
"fix rate limiting" would have silently turned Upstash into a hard dependency for session
validation across the whole app — a much bigger, undiscussed change that directly
contradicts this project's DB-backed-sessions design (see `auth.md`, AGENTS.md §6).

`rateLimit.customStorage` is a separate, narrower contract (`get`/`set`/`consume`) that
better-auth's rate limiter checks first (`getRateLimitStorage`: "if
`ctx.options.rateLimit?.customStorage` return it") and nothing else in the library reads
from — the properly scoped mechanism for "shared rate-limit counters" without touching
session storage.

## Why `consume` is implemented (not just `get`/`set`)

**Why:** better-auth's router calls `storage.consume` when present for an atomic
check-and-increment; without it, it falls back to a non-atomic `get`-then-`set` path that
its own source code warns is "best-effort... concurrent requests can each pass the check
before either write lands." Implementing `consume` — via Redis `INCR` (atomic) followed by
`EXPIRE` only on the first hit (`count === 1`), so the window's TTL is set once and never
extended by later requests — gets the strict path automatically. `get`/`set` still exist to
satisfy the type but are effectively dead code once `consume` is present.

## Why `consume` fails open on a Redis error

**Why:** `onRequestRateLimit` runs ahead of **every** request to `/api/auth/*` — sign-in,
sign-up, session checks, everything — with no surrounding try/catch in better-auth's
router. An unhandled rejection from a transient Upstash network blip or outage would 500
every one of those requests, not just the ones that would've been rate-limited. `consume`
catches any Redis error, logs it via the shared Pino [`logger`](../../lib/logger.ts), and
returns `{ allowed: true }` — trading a brief loss of rate-limit coverage (an infra hiccup,
not something an external attacker can trigger on demand) for keeping auth itself alive.
Fail-closed would be the wrong default for a case where the failure mode is "the whole app
is unusable," not "one abusive client gets through."

```text
get(key):    redis.get(key)                    # legacy fallback; unused while consume exists
set(key, value): redis.set(key, value)          # legacy fallback; unused while consume exists
consume(key, {window, max}):
  try:
    count = redis.incr(key)                    # atomic; creates at 1 if absent
    if count === 1: redis.expire(key, window)  # TTL set ONCE, on creation only
    return {allowed: count <= max, retryAfter: null | window}
  catch (redis error):
    log it; return {allowed: true, retryAfter: null}   # fail OPEN
```

## Env var naming: two conventions accepted

**Why:** creating the database directly at upstash.com labels the REST credentials
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`. Provisioning the same database via
Vercel's **"Upstash for Redis" marketplace integration** (Storage → Marketplace, not the
retired first-party "Vercel KV" product) instead injects them as `KV_REST_API_URL`/
`KV_REST_API_TOKEN` — confirmed against a real install (July 2026). Both names are checked,
`UPSTASH_REDIS_REST_*` first, mirroring the exact fallback `@upstash/redis`'s own
`Redis.fromEnv()` documents ("provides compatibility with Vercel KV and other platforms
that may use different naming conventions") — replicated by hand here rather than calling
`fromEnv()` directly so an unconfigured environment (local dev with neither set) stays
silent instead of `fromEnv()`'s built-in `console.warn` on every server start.

## Why this lives outside `auth.ts`

Colocated as its own module rather than inlined so `auth.ts` stays focused on `betterAuth()`
configuration; the Redis client construction, the `customStorage`-vs-`secondaryStorage`
tradeoff, and the fail-open handling are a self-contained unit worth reading (and testing)
on their own.
