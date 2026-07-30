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
  trustedOrigins: this deployment's own Vercel origins + explicit env list   # see below
  database: drizzleAdapter(db, provider "pg", schema = auth tables)
  rateLimit.customStorage — ONLY if Upstash env creds exist (see below)
  emailAndPassword: enabled, password hashing overridden to Argon2id (see password.ts)
  socialProviders: google — ONLY if its env creds exist
  plugins: [ passkey(rpID, rpName, origin=appUrl), nextCookies() ]   # nextCookies LAST
```

## Why `trustedOrigins` is scoped to this deployment (not a Vercel wildcard)

**Why:** better-auth always trusts `baseURL`'s own origin automatically, so production (via
`BETTER_AUTH_URL`) needs no extra config. But Vercel preview deployments each get a unique
subdomain per branch/PR that `baseURL` doesn't know ahead of time — without an explicit trusted
origin, the Origin/CSRF check (`origin-check` middleware) and OAuth/passkey callback validation
would reject every preview deployment.

The **first** fix (July 2026) used `trustedOrigins: ['https://*.vercel.app']`. That worked, but the
wildcard trusts **every** `*.vercel.app` deployment — i.e. every other Vercel customer's app — as a
trusted origin for this app's CSRF/origin checks, not just this project's own previews. AGENTS.md §6
calls out scoping preview trust narrowly, so this was tightened:

- **Per-deployment, not wildcard.** We build the list from Vercel's system env vars — `VERCEL_URL`
  (the immutable per-deployment URL) and `VERCEL_BRANCH_URL` (the branch alias) — each prefixed with
  `https://`. These resolve to *this* deployment's own origins only; a stranger's `*.vercel.app`
  deployment is never trusted. Locally (env vars unset) the list is empty and only `baseURL` is
  trusted, which is correct for `localhost` dev.
- **Explicit escape hatch.** `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) can add any further
  origin (e.g. a custom preview or staging domain) without reintroducing a wildcard.
- **De-duplicated** via a `Set` before being passed to better-auth.

Note: passkeys still bind to the stable `rpID` from `BETTER_AUTH_URL`, so passkey login across
changing preview domains is a separate constraint — this change is only about the Origin/CSRF trust
surface for the auth endpoints. Original wildcard added while auditing against
`Docs/research/ai-assisted-nextjs-security-reference.md`; scoped down in the follow-up review pass.

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
