import 'server-only';
import { createDb, type Database } from './connection';

/**
 * Server-only Drizzle client — the single instance the Next.js app shares.
 *
 * The `server-only` import is a build-time guard: if any Client Component ever imports
 * this module (which would leak `DATABASE_URL` toward the browser bundle), the build
 * fails loudly instead of silently shipping the connection string. DB access must stay
 * inside feature services (AGENTS.md §1), never in components.
 *
 * The actual connection is built by the unguarded `createDb` factory in
 * [connection.ts](./connection.ts), which standalone scripts also use — this file only
 * adds the guard and the env read on top of it. All access is parameterized through
 * Drizzle's query builder (AGENTS.md §6): no string-built SQL.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and provide a Neon connection string.',
  );
}

export const db = createDb(databaseUrl);

export type { Database };
