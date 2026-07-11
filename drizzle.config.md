# drizzle-kit Config (`drizzle.config.ts`)

Configuration for the drizzle-kit CLI. This is a **build-time tool only** — it never gets
bundled into the running app.

## Why the split between `generate` and `migrate`

**Why:** `db:generate` diffs the schema against the existing migrations and emits new
versioned SQL into `src/lib/db/migrations`; it needs no live database, so it runs offline
in CI or locally without credentials. `db:migrate` applies those SQL files and **does**
read `DATABASE_URL`. Keeping generation and application separate lets migrations be
reviewed as checked-in SQL and run under a privileged role, while the app's runtime DB
role holds least privilege with no DDL rights (AGENTS.md §6).

```text
schema  -> [./src/lib/db/schema.ts, ./src/lib/db/auth-schema.ts]  (app + auth tables)
out     -> ./src/lib/db/migrations  (checked-in versioned SQL)
dialect -> postgresql
url     -> DATABASE_URL from the environment (used by `migrate`, not `generate`)
strict + verbose -> confirm destructive changes and log what runs
```
