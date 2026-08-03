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

export interface TodayCompletion {
  difficulty: string;
  puzzleId: string;
  timeMs: number;
}

/**
 * The daily difficulties the user has already completed *today* (UTC), with their time.
 * Backs the "you already solved this — come back tomorrow" state so the UI can stop a
 * one-attempt daily from being replayed. Scoped to `userId` (BOLA) and `completed`.
 */
export function getTodayCompletions(
  db: Database,
  userId: string,
  isoDate: string,
): Promise<TodayCompletion[]> {
  return db
    .select({
      difficulty: dailyPuzzles.difficulty,
      puzzleId: solveAttempts.puzzleId,
      timeMs: solveAttempts.timeMs,
    })
    .from(solveAttempts)
    .innerJoin(dailyPuzzles, eq(solveAttempts.puzzleId, dailyPuzzles.id))
    .where(
      and(
        eq(solveAttempts.userId, userId),
        eq(solveAttempts.completed, true),
        eq(dailyPuzzles.date, isoDate),
      ),
    );
}

export interface PersonalBest {
  difficulty: string;
  variant: string;
  /** Board size (4/6/9), derived from the stored grid — there is no `grid_size` column. */
  gridSize: number;
  bestMs: number;
}

/**
 * A user's best (fastest) completed time per `(difficulty, variant)`, across all days — their
 * all-time personal bests. Scoped to `userId` (BOLA); grouped via a join to `daily_puzzles`.
 *
 * **Grouped by `(difficulty, variant, gridSize)` — all three axes a slot key rolls (Risk #4):**
 *
 * - *Type:* a rung key like `hard` holds a different TYPE each day (Classic one day, Killer the
 *   next), so grouping by the key alone would collapse distinct types under one "best".
 * - *Size:* the `mini-hard` slot also rolls its SIZE (4×4 or 6×6 — see `rollDailyAssignment`). So
 *   `(mini-hard, classic)` alone spans two genuinely different boards, and because the 4×4 is much
 *   faster (its plausibility floor is 5 s against the 6×6's 12 s) the 4×4 time would always win the
 *   `min()` — permanently hiding the 6×6 best and showing an unbeatable target on 6×6 days.
 *
 * Size comes from `jsonb_array_length(grid)` because there is no `grid_size` column; the grid is the
 * same source `seedBotSolves` and the solve floor already derive size from. Historical rows (all
 * `variant` backfilled by migration `0004`) slot in cleanly — old classic-only `hard` rows group
 * under `(hard, classic, 9)`.
 */
export function getPersonalBests(db: Database, userId: string): Promise<PersonalBest[]> {
  const gridSize = sql<number>`jsonb_array_length(${dailyPuzzles.grid})`;
  return db
    .select({
      difficulty: dailyPuzzles.difficulty,
      variant: dailyPuzzles.variant,
      gridSize: gridSize.mapWith(Number),
      bestMs: sql<number>`min(${solveAttempts.timeMs})`.mapWith(Number),
    })
    .from(solveAttempts)
    .innerJoin(dailyPuzzles, eq(solveAttempts.puzzleId, dailyPuzzles.id))
    .where(and(eq(solveAttempts.userId, userId), eq(solveAttempts.completed, true)))
    .groupBy(dailyPuzzles.difficulty, dailyPuzzles.variant, gridSize);
}
