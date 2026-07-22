# Auth Instance (`auth.ts`)

The single `betterAuth()` server instance — the source of truth for authentication.

## Why passkeys-first, DB sessions, server-only

**Why:** AGENTS.md §6 mandates passkeys as the primary method and forbids tokens in web
storage. So the passkey plugin is the primary returning-login; email/password and Google
OAuth are account bootstraps; and sessions are stored in the **database** (not JWTs), with
better-auth issuing `HttpOnly`/`Secure`/`SameSite=Lax` cookies. The module is `server-only`
because it reads OAuth secrets from env and must never reach the client bundle. Everything
downstream depends only on `session.user.id`, so the auth-library choice stays isolated here
— the 4.3.1 BOLA layer and 4.4 leaderboards never import better-auth directly.

## Why Google is conditional

**Why:** Google is registered only when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are
present. A missing OAuth app then can't break the build or startup — email/password and
passkeys still work without it. This lets the backend ship before the OAuth app exists.

```text
appUrl  = BETTER_AUTH_URL (or http://localhost:3000)
rpID    = hostname of appUrl        (passkey relying-party id)

betterAuth:
  baseURL:        appUrl
  trustedOrigins: ['https://*.vercel.app']   # see below
  database: drizzleAdapter(db, provider "pg", schema = auth tables)
  rateLimit.customStorage — ONLY if Upstash env creds exist (see below)
  emailAndPassword: enabled, password hashing overridden to Argon2id (see password.ts)
  socialProviders: google — ONLY if its env creds exist
  plugins: [ passkey(rpID, rpName, origin=appUrl), nextCookies() ]   # nextCookies LAST
```

## Why `trustedOrigins` includes a Vercel preview wildcard (July 2026)

**Why:** better-auth always trusts `baseURL`'s own origin automatically, so production (via
`BETTER_AUTH_URL`) needed no extra config. But Vercel preview deployments each get a unique
`*.vercel.app` subdomain per branch/PR that `baseURL` doesn't know about ahead of time —
without an explicit trusted pattern, the Origin/CSRF check (`origin-check` middleware) and
OAuth/passkey callback validation would reject every preview deployment. better-auth's
pattern matcher supports wildcards natively (`matchesOriginPattern`), so this only *widens*
trust to Vercel's own preview domains — it can't loosen anything about the production origin.
Added while auditing the codebase against a new web-security research doc
(`Docs/research/ai-assisted-nextjs-security-reference.md`).

## Why rate-limit storage is conditional (July 2026)

**Why:** better-auth's rate limiter is on by default in production, but its default
storage is in-memory counters — private to one serverless instance, so they don't
coordinate across Vercel's separately-scaled instances or survive a cold start. That made
the protection weaker than it looked (roadmap backlog, tabled alongside the July 2026
security-hardening pass). [`rate-limit-storage.ts`](./rate-limit-storage.md) wires
`rateLimit.customStorage` to Upstash Redis when `UPSTASH_REDIS_REST_URL`/
`UPSTASH_REDIS_REST_TOKEN` are set, spread in conditionally (same pattern as
`socialProviders`) so local dev without Upstash creds is unaffected — it just keeps the
in-memory default. No new `customRules` were added: better-auth already ships sane
defaults for the sensitive paths (sign-in/sign-up/change-password: 3 requests/10s;
password-reset/verification-email: 3/60s) — the gap being closed here is purely the
storage backend, not the limits themselves.

**Why `rateLimit.customStorage`, not the top-level `secondaryStorage` option:** the obvious
first attempt — set `secondaryStorage` to an Upstash client and `rateLimit.storage:
'secondary-storage'` — is a trap. better-auth's own docs state that once `secondaryStorage`
is set *at all*, session reads are **always** served from it instead of the database
("Reads are always done from the secondary storage" — `session.storeSessionInDatabase`
only controls whether a DB copy is *also* kept, not which one is read from). That would
have silently repointed session validation at Upstash for every authenticated request in
the app, directly contradicting this project's DB-backed-sessions design (AGENTS.md §6) and
turning any Upstash hiccup into a full outage of session checks, not just rate limiting.
`rateLimit.customStorage` is a separate, rate-limit-only interface (`get`/`set`/`consume`)
that better-auth's router checks first and never touches session storage — the properly
scoped mechanism for this.

## `username` additional field

**Why:** A public leaderboard handle is declared as `user.additionalFields.username`
(`required: false`, `input: true`) so better-auth returns it in the session user and lets
`updateUser({ username })` set it. Uniqueness is enforced by the DB constraint (a taken
handle surfaces as an error), not by better-auth. The client mirrors this via
`inferAdditionalFields` (see [auth-client.md](./auth-client.md)).

## Gotchas encoded here

- **Passkey is `@better-auth/passkey`** in 1.6.x (a separate package), not bundled in core.
- **`nextCookies()` must be last** — it attaches `Set-Cookie` via Next's `cookies()` in
  server actions.
- **Neon HTTP has no transactions** — the adapter's `transaction` option is left unset
  (defaults off); enabling it would throw on this driver.
