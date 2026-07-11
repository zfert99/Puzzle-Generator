import { config } from 'dotenv';

/**
 * Side-effect module: loads developer secrets for standalone Node scripts (seed,
 * one-off tooling) run via `tsx`. Imported FIRST — before the server-only db client,
 * which reads `DATABASE_URL` at module-eval time — because ES module imports are
 * evaluated in source order, so this must appear above any db import to win the race.
 *
 * `.env.local` (Next convention, git-ignored) takes precedence; `.env` is a fallback.
 * dotenv never overrides an already-set process env var. Not used by the Next.js app
 * itself — Next loads `.env.local` natively.
 */
config({ path: ['.env.local', '.env'] });
