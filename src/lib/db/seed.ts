import './load-env'; // MUST be first — loads DATABASE_URL before it is read below.
import { generateSudoku } from '@/features/engine/sudoku';
import { createDb } from './connection';
import { dailyPuzzles } from './schema';
import { DAILY_DIFFICULTIES, toDailyPuzzleRow, toUtcDateString } from './daily-row';

/**
 * Local seed script — generates today's (UTC) daily puzzle for each eligible
 * difficulty and upserts them, so a fresh local database has something for the /daily
 * route to load before the 4.2 cron exists.
 *
 * Idempotent by design: the `UNIQUE(date, difficulty)` constraint plus
 * `onConflictDoNothing` make re-running a no-op rather than a duplicate. Run with:
 *   npm run db:seed
 */
async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local (see .env.example).');
  }
  const db = createDb(databaseUrl);

  const isoDate = toUtcDateString(new Date());
  const rows = DAILY_DIFFICULTIES.map((difficulty) =>
    toDailyPuzzleRow(generateSudoku(difficulty), isoDate),
  );

  const inserted = await db
    .insert(dailyPuzzles)
    .values(rows)
    .onConflictDoNothing({ target: [dailyPuzzles.date, dailyPuzzles.difficulty] })
    .returning({ id: dailyPuzzles.id, difficulty: dailyPuzzles.difficulty });

  console.log(
    `Seeded ${isoDate}: ${inserted.length} new daily puzzle(s)` +
      (inserted.length < rows.length ? ` (${rows.length - inserted.length} already existed)` : ''),
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
