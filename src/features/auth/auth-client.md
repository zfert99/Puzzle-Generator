# Auth Client (`auth-client.ts`)

The browser-side better-auth client — the client counterpart to the server `auth` instance.

## Why

**Why:** Client Components can't call the server `auth` instance directly, so they use this
client, which talks to `/api/auth/*` on the same origin (no `baseURL` needed). It carries
the passkey plugin so `signIn.passkey()` / `passkey.addPasskey()` exist. It holds no secrets
— those stay server-side; this only calls the endpoints. Import from Client Components only.

```text
exports: authClient, and destructured signIn / signUp / signOut / useSession / passkey / updateUser
```

## `inferAdditionalFields`

**Why:** The server declares a `username` additional field, but the client type doesn't know
about it by default — so `updateUser({ username })` and `session.user.username` would fail to
type-check. `inferAdditionalFields({ user: { username: { type: 'string' } } })` teaches the
client (using the **object form**, so we avoid importing the `server-only` `auth` instance).

## `basePath` under Next `basePath` (Phase 3 multi-zone)

**Why:** With `basePath: '/puzzles'`, the auth route handler is served at `/puzzles/api/auth/*`.
The client's default (`/api/auth`) would 404, so set the client **`basePath: '/puzzles/api/auth'`**.
Do **not** use `baseURL` for this — better-auth runs `new URL(baseURL)`, which throws on a
relative path (`Invalid base URL`, seen at build during SSG). With no `baseURL`, better-auth
resolves the origin itself (`window.location.origin` in the browser; `BETTER_AUTH_URL`/
`VERCEL_URL` at build) and appends the `basePath`, so dev/preview/prod all work without
hardcoding a host. Still **verify the full auth round-trip at cutover** (validation doc §3).
