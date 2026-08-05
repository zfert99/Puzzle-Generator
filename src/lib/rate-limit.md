# Per-IP Rate Limiter (`rate-limit.ts`)

Throttles the public, CPU-heavy generation routes — `/api/generate` (PDF batch) and `/api/puzzle`
(single interactive puzzle). Both run the synchronous solver/generator with `maxDuration = 60` and
take **no auth**, so without a throttle anyone can exhaust serverless compute/$ by hammering them
(the code-review **H1** finding). better-auth's built-in rate limiter only covers `/api/auth/*`, so
these app routes need their own limiter.

## Design

- **Fixed-window counter**, keyed per IP per route (`generate:<ip>`, `puzzle:<ip>`).
- **Shared store when configured:** backed by the same Upstash Redis credentials as the auth
  rate-limit storage (`UPSTASH_REDIS_REST_*` or Vercel's `KV_REST_API_*`), so the count is shared
  across Vercel's separately-scaled serverless instances via atomic `INCR` + first-write `EXPIRE`.
- **In-memory fallback** when Upstash isn't configured (local dev): a per-instance `Map`. Weaker
  (each cold-started instance keeps its own counters) but correct for dev and strictly better than no
  limit. The map is size-capped (`MAX_MEMORY_KEYS`) and drops expired buckets when full, so a flood of
  distinct IPs can't grow it without bound.
- **Fails open** on any Redis error — a transient Upstash blip should degrade the throttle, not take
  the route down. (Same availability-over-strictness call as `rate-limit-storage.ts`.)
- **No-op under test** (`NODE_ENV === 'test'`) so the route test suites aren't throttled by shared
  buckets. The counting logic is unit-tested directly via the pure core instead (see below).

## Exports

| Export | Purpose |
|---|---|
| `rateLimit(key, rule)` | The wired entrypoint the routes call. Redis → in-memory → test no-op. Returns `{ allowed, retryAfter }`. |
| `consumeFixedWindow(store, key, nowMs, rule)` | The **pure** counter core — no Redis/env/clock. This is what the in-memory path and the unit tests use, so the algorithm is testable without mocking infrastructure. |
| `clientIp(req)` | Best-effort IP from `x-forwarded-for` / `x-real-ip` (the headers Vercel sets). Takes the **first** entry; see "Is the key forgeable?" below for why that is safe here. Falls back to `'unknown'` — a single shared bucket, so a missing IP is throttled, not exempt. |

## Rules in use

| Route | Rule | Rationale |
|---|---|---|
| `/api/generate` | 10 req / 60 s | Heavy PDF batch (up to 50 puzzles, Extreme is seconds each). |
| `/api/puzzle` | 30 req / 60 s | One puzzle per interactive game; generous headroom for a real player. |

On rejection the route returns **429** with a `Retry-After` header (seconds).

## Is the key forgeable? No — measured, August 2026

`clientIp` reads a header and takes `.split(',')[0]`, which in general is the classic spoofable
rate-limit key: if the platform *appends* the real IP to a client-supplied `x-forwarded-for`, the
attacker picks their own bucket and the limiter becomes decoration. A security pass raised exactly
that. It does not apply to this deployment, and the reason is worth writing down so it isn't
re-raised.

Vercel's [request-headers docs](https://vercel.com/docs/headers/request-headers) state it plainly:
"we currently **overwrite** the `X-Forwarded-For` header and **do not forward external IPs**. This
restriction is in place to prevent IP spoofing." That guarantee is caveated for "a proxy on top of
Vercel" — and this app *is* behind one, since the hub rewrites `biscuitlab.net/puzzles/*` into this
zone. So it was tested rather than assumed, against production:

| Probe | Result | Conclusion |
|---|---|---|
| 12 sequential, no header | `200`×10 then `429`×2 | The 10/60 s rule is enforced |
| 12 sequential, each with a different forged `x-forwarded-for` | `200`×10 then `429`×2 — **identical** | The forged header is discarded; the key is the real client IP |
| 12 **concurrent**, no header | exactly 10 × `200`, 2 × `429` | The counter is **shared and atomic** across instances — Upstash is live in production, not the in-memory fallback |
| Exhaust via `biscuitlab.net`, then one request direct to `origin-puzzles.biscuitlab.net` | `429` | Both entry points hit the **same** bucket, so the hub's rewrite preserves the client IP |

The last row answers the question the third one raises: the hub does **not** collapse all visitors
into a single bucket keyed on its own egress IP — which would have capped the whole site at 10
generations a minute. The counter followed one client across two different entry domains, so
bucketing is genuinely per-visitor.

**If a real external proxy (Cloudflare, a custom CDN) is ever put in front of the hub, re-run these
probes.** That is the configuration Vercel's caveat is about, and it is the one where
`x-vercel-forwarded-for` — which Vercel documents as surviving a proxy on top of Vercel — becomes
the header to prefer. Until then, changing it would be churn against a measured-correct behaviour.

## Why not `@upstash/ratelimit`

That package would do this too, but it's a new dependency for a counter we can express in a few lines
on the `@upstash/redis` client already in the tree — AGENTS.md §6 cautions against adding packages
that aren't necessary (and against hallucinated/slopsquatted names). The `INCR`/`EXPIRE` pattern here
mirrors the existing `rate-limit-storage.ts`.
