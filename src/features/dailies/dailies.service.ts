import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { dailyPuzzles, type DailyPuzzle } from '@/lib/db/schema';
import {
  DAILY_DIFFICULTIES,
  toDailyPuzzleRow,
  type DailyDifficulty,
} from '@/lib/db/daily-row';
import { generateSudoku } from '@/features/engine/sudoku';

/**
 * Daily-puzzle data access. Every function takes the Drizzle `db` as its first
 * argument rather than importing the `server-only` client at module scope — that keeps
 * this module importable from BOTH the API routes (which pass the guarded app client)
 * and the standalone seed script (which runs under `tsx`, where the guard would throw).
 * The `Database` import is type-only, so nothing here pulls the Neon driver at import.
 *
 * All access is parameterized through Drizzle (AGENTS.md §6). Ownership/authorization is
 * not a concern here — daily puzzles are shared, public, and read-only to clients; the
 * BOLA-sensitive writes live in the leaderboard/solve service (4.3.1 / 4.4).
 */

export interface GenerateDailiesResult {
  isoDate: string;
  requested: number;
  inserted: number;
}

/**
 * Generate and persist one puzzle per eligible difficulty for `isoDate` (UTC).
 * Idempotent: the `UNIQUE(date, difficulty)` constraint plus `onConflictDoNothing` make
 * a re-run a no-op, so the cron is safe to retry and a same-day second call inserts 0.
 */
export async function generateDailyPuzzles(
  db: Database,
  isoDate: string,
): Promise<GenerateDailiesResult> {
  const rows = DAILY_DIFFICULTIES.map((difficulty) =>
    toDailyPuzzleRow(generateSudoku(difficulty), isoDate),
  );

  const inserted = await db
    .insert(dailyPuzzles)
    .values(rows)
    .onConflictDoNothing({ target: [dailyPuzzles.date, dailyPuzzles.difficulty] })
    .returning({ id: dailyPuzzles.id });

  return { isoDate, requested: rows.length, inserted: inserted.length };
}

/**
 * Fetch the single daily puzzle for a given UTC date + difficulty, or `null` if the
 * cron has not generated it yet. Returns the full row including `solution`; the CALLER
 * (the route) decides what to expose to the client.
 */
export async function getDailyPuzzle(
  db: Database,
  isoDate: string,
  difficulty: DailyDifficulty,
): Promise<DailyPuzzle | null> {
  const [row] = await db
    .select()
    .from(dailyPuzzles)
    .where(and(eq(dailyPuzzles.date, isoDate), eq(dailyPuzzles.difficulty, difficulty)))
    .limit(1);

  return row ?? null;
}
