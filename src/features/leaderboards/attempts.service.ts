import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts, dailyPuzzles, type SolveAttempt } from '@/lib/db/schema';

/**
 * Ownership-scoped reads of a user's solve attempts — the data-access half of the BOLA
 * defense (AGENTS.md §6, 4.3.1).
 *
 * **Every function requires a `userId` and filters by it in the query** (`WHERE user_id =
 * userId`), never in application code after a broad fetch. Callers must pass the id from
 * the session (`requireUserId()`), never one taken from the request — so a caller can only
 * ever see their own rows. There is deliberately no "get any attempt by id" function that
 * would let a route forget the ownership predicate.
 *
 * Writes (recording a verified solve) arrive in 4.4 and will follow the same rule: the
 * `userId` is server-supplied, and the `UNIQUE(user_id, puzzle_id)` constraint caps one
 * ranked attempt per user per puzzle.
 */

/** All of a user's attempts, newest first. Scoped to `userId`. */
export function getUserAttempts(db: Database, userId: string): Promise<SolveAttempt[]> {
  return db
    .select()
    .from(solveAttempts)
    .where(eq(solveAttempts.userId, userId))
    .orderBy(desc(solveAttempts.createdAt));
}

/** A user's single attempt at one puzzle (e.g. "have I already solved today?"), or null. */
export async function getUserAttemptForPuzzle(
  db: Database,
  userId: string,
  puzzleId: string,
): Promise<SolveAttempt | null> {
  const [row] = await db
    .select()
    .from(solveAttempts)
    .where(and(eq(solveAttempts.userId, userId), eq(solveAttempts.puzzleId, puzzleId)))
    .limit(1);
  return row ?? null;
}

export interface PersonalBest {
  difficulty: string;
  bestMs: number;
}

/**
 * A user's best (fastest) completed time per difficulty, across all days — their all-time
 * personal bests. Scoped to `userId` (BOLA); grouped by the puzzle's difficulty via a join.
 */
export function getPersonalBests(db: Database, userId: string): Promise<PersonalBest[]> {
  return db
    .select({
      difficulty: dailyPuzzles.difficulty,
      bestMs: sql<number>`min(${solveAttempts.timeMs})`.mapWith(Number),
    })
    .from(solveAttempts)
    .innerJoin(dailyPuzzles, eq(solveAttempts.puzzleId, dailyPuzzles.id))
    .where(and(eq(solveAttempts.userId, userId), eq(solveAttempts.completed, true)))
    .groupBy(dailyPuzzles.difficulty);
}
