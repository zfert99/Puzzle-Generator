# DB Client (`client.ts`)

Exports the single server-only Drizzle client (`db`) the whole app shares.

## Why `server-only`

**Why:** The first import is `'server-only'`. It is a build-time tripwire — if any Client
Component ever imports this module (which would drag `DATABASE_URL` toward the browser
bundle), the build fails loudly instead of silently shipping the connection string. DB
access is meant to stay inside feature services (AGENTS.md §1), never in components; this
guard enforces that structurally.

## Why the connection is built elsewhere

**Why:** The actual Drizzle-over-Neon-HTTP wiring lives in the unguarded
[connection.ts](./connection.ts) `createDb` factory, which standalone scripts reuse (they
cannot import this guarded module — `server-only` throws outside a bundler). This file only
adds the guard and the env read on top of that factory, so there is one definition of "how
we connect" and the guard sits only where components could reach it.

```text
Read DATABASE_URL from the environment.
If it is missing, throw immediately with a clear "copy .env.example" message
  (fail fast at startup rather than on the first query).
Build the client via createDb(DATABASE_URL).
Export `db`.
```

## Security note

All access goes through Drizzle's parameterized query builder (AGENTS.md §6). The runtime
DB role should hold least privilege — migrations run separately via drizzle-kit, so the
app role needs no DDL rights.
