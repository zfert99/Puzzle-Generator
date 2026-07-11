# DB Connection Factory (`connection.ts`)

Exports `createDb(url)` — the shared builder that wires Drizzle onto Neon's HTTP driver.

## Why this exists separately from `client.ts`

**Why:** The app's client ([client.ts](./client.ts)) carries a `server-only` guard so it
can never leak `DATABASE_URL` into a browser bundle. But that guard **throws** when the
module is loaded by a plain Node script under `tsx` (the seed script, migration tooling),
because there is no bundler to satisfy `server-only`'s `react-server` export condition. So
the connection-building logic lives here, unguarded, and two callers build on it:

- `client.ts` adds the `server-only` guard + env read (the only path components reach).
- Standalone scripts call `createDb` directly with an already-loaded env.

This keeps one definition of "how we connect" while letting the guard sit only where it
belongs.

```text
createDb(databaseUrl):
  Build a Neon HTTP client from the URL.
  Wrap it in Drizzle with the COMBINED schema — app tables (schema.ts) plus better-auth's
    identity tables (auth-schema.ts) — so every query is typed and better-auth's adapter
    can resolve its tables via `db`.
  Return it.
```

## Why the HTTP driver

Each query goes over `fetch`, which fits both Vercel's short-lived serverless functions
and one-shot CLI scripts — neither can hold a warm connection pool.
