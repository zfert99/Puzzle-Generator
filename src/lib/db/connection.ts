import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as appSchema from './schema';
import * as authSchema from './auth-schema';

// App tables (daily_puzzles, solve_attempts) plus better-auth's identity tables
// (user, session, account, verification, passkey) — one combined schema so every
// query is typed and better-auth's Drizzle adapter can resolve its tables via `db`.
const schema = { ...appSchema, ...authSchema };

/**
 * Unguarded Drizzle-over-Neon-HTTP client factory.
 *
 * This module carries NO `server-only` guard on purpose: it is the shared connection
 * builder used both by the guarded app client ([client.ts](./client.ts)) and by
 * standalone Node scripts (seed, migrations tooling) that run under `tsx` — where
 * `server-only` would (correctly) throw because there is no bundler to satisfy its
 * `react-server` export condition. The guard therefore lives in `client.ts`, which is
 * the only path a Server/Client Component can reach; scripts call this factory directly.
 *
 * The Neon HTTP driver issues each query over `fetch`, which suits both Vercel's
 * short-lived serverless functions and one-shot CLI scripts (no pool to drain).
 */
export function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema });
}

export type Database = ReturnType<typeof createDb>;
