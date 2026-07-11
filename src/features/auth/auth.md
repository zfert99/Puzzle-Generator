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
  baseURL:  appUrl
  database: drizzleAdapter(db, provider "pg", schema = auth tables)
  emailAndPassword: enabled, password hashing overridden to Argon2id (see password.ts)
  socialProviders: google — ONLY if its env creds exist
  plugins: [ passkey(rpID, rpName, origin=appUrl), nextCookies() ]   # nextCookies LAST
```

## Gotchas encoded here

- **Passkey is `@better-auth/passkey`** in 1.6.x (a separate package), not bundled in core.
- **`nextCookies()` must be last** — it attaches `Set-Cookie` via Next's `cookies()` in
  server actions.
- **Neon HTTP has no transactions** — the adapter's `transaction` option is left unset
  (defaults off); enabling it would throw on this driver.
