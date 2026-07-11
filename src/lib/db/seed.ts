import './load-env'; // MUST be first — loads DATABASE_URL before it is read below.
import { createDb } from './connection';
import { toUtcDateString } from './daily-row';
import { generateDailyPuzzles } from '@/features/dailies/dailies.service';

/**
 * Local seed script — generates today's (UTC) daily puzzle for each eligible
 * difficulty and upserts them, so a fresh local database has something for the /daily
 * route to load before the 4.2 cron fires (or when developing without cron).
 *
 * Delegates to the same `generateDailyPuzzles` service the cron uses, so seed and cron
 * can never drift. Idempotent: the `UNIQUE(date, difficulty)` constraint plus
 * `onConflictDoNothing` make a re-run a no-op. Run with: npm run db:seed
 */
async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local (see .env.example).');
  }
  const db = createDb(databaseUrl);

  const { isoDate, requested, inserted } = await generateDailyPuzzles(db, toUtcDateString(new Date()));

  console.log(
    `Seeded ${isoDate}: ${inserted} new daily puzzle(s)` +
      (inserted < requested ? ` (${requested - inserted} already existed)` : ''),
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
