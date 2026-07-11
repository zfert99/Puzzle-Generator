import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read Next.js env files automatically. Load `.env.local`
// (developer secrets) first, then `.env` — dotenv never overrides an already-set var.
config({ path: ['.env.local', '.env'] });

/**
 * drizzle-kit configuration (build-time CLI only — never bundled into the app).
 *
 * `generate` diffs the schema and emits versioned SQL into src/lib/db/migrations; it
 * needs no live database. `migrate` applies those files and DOES read DATABASE_URL.
 * Migrations are checked in and run separately from the app so the runtime DB role can
 * hold least privilege (no DDL at runtime — AGENTS.md §6).
 */
export default defineConfig({
  // Both the app tables and better-auth's identity tables (auth-schema.ts).
  schema: ['./src/lib/db/schema.ts', './src/lib/db/auth-schema.ts'],
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Prefer a direct (non-pgbouncer) connection for DDL — Neon recommends the
    // unpooled endpoint for migrations. Falls back to the app's pooled URL.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
