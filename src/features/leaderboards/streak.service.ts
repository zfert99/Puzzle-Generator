import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts, dailyPuzzles } from '@/lib/db/schema';
import { currentStreak } from './streak';

/**
 * A user's current daily streak — consecutive UTC days with a completed daily. Scoped to
 * the caller (`WHERE user_id = userId`, BOLA); the consecutive-day arithmetic lives in the
 * pure `currentStreak` helper so it can be unit-tested without a DB.
 */
export async function getCurrentStreak(
  db: Database,
  userId: string,
  today: string,
): Promise<number> {
  const rows = await db
    .select({ date: dailyPuzzles.date })
    .from(solveAttempts)
    .innerJoin(dailyPuzzles, eq(solveAttempts.puzzleId, dailyPuzzles.id))
    .where(and(eq(solveAttempts.userId, userId), eq(solveAttempts.completed, true)));

  return currentStreak(
    rows.map((r) => r.date),
    today,
  );
}
