import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts, type DailyPuzzle, type SolveAttempt } from '@/lib/db/schema';
import type { DailyDifficulty } from '@/lib/db/daily-row';
import { getUserAttemptForPuzzle } from './attempts.service';
import { gridsMatch, isImplausiblyFast } from './solve-rules';
import type { Grid } from '@/lib/db/schema';

/**
 * Recording a ranked solve — the anti-cheat core (4.4). Two rules are non-negotiable and
 * enforced here, server-side:
 *   1. **Time is server-measured.** The attempt row's `created_at` (set when the user
 *      *starts*, below) is the authoritative start; the submit time is the server clock.
 *      A client-reported duration is never trusted.
 *   2. **The grid is verified** against the stored solution before any time is recorded.
 * Plus a plausibility floor and one ranked attempt per user per puzzle
 * (`UNIQUE(user_id, puzzle_id)`). `userId` is always the caller's session id (BOLA, 4.3.1).
 */

export type SolveErrorCode = 'NOT_STARTED' | 'ALREADY_COMPLETED' | 'INCORRECT_SOLUTION' | 'TOO_FAST';

/** A rejected solve. `status` is the HTTP status the route should return. */
export class SolveError extends Error {
  constructor(
    public readonly code: SolveErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SolveError';
  }
}

/**
 * Record that a user has *started* a puzzle, stamping the server-side start time.
 * Idempotent: `onConflictDoNothing` means a repeat start does not reset the clock, so a
 * refresh can't extend or restart your timer. Returns the (possibly pre-existing) row.
 *
 * `created_at` is set explicitly from the app clock (not the DB's `now()`) so that the
 * *same* clock measures both ends of the solve — mixing the app clock at submit with the
 * DB clock at start would skew every recorded time by the app↔DB clock offset.
 */
export async function startAttempt(
  db: Database,
  userId: string,
  puzzleId: string,
): Promise<SolveAttempt> {
  await db
    .insert(solveAttempts)
    .values({ userId, puzzleId, timeMs: 0, completed: false, createdAt: new Date() })
    .onConflictDoNothing({ target: [solveAttempts.userId, solveAttempts.puzzleId] });

  const existing = await getUserAttemptForPuzzle(db, userId, puzzleId);
  // The insert above guarantees a row exists for this (user, puzzle).
  return existing as SolveAttempt;
}

/**
 * Validate and record a completed solve. Throws `SolveError` on any rejection (unstarted,
 * already completed, wrong grid, implausibly fast). On success, marks the attempt complete
 * with the server-computed time and returns it.
 */
export async function recordSolve(
  db: Database,
  args: {
    userId: string;
    puzzle: DailyPuzzle;
    difficulty: DailyDifficulty;
    submittedGrid: Grid;
    mistakes: number;
    now: number;
  },
): Promise<SolveAttempt> {
  const { userId, puzzle, difficulty, submittedGrid, mistakes, now } = args;

  const attempt = await getUserAttemptForPuzzle(db, userId, puzzle.id);
  if (!attempt) {
    throw new SolveError('NOT_STARTED', 400, 'No start was recorded for this puzzle');
  }
  if (attempt.completed) {
    throw new SolveError('ALREADY_COMPLETED', 409, 'This daily has already been completed');
  }
  if (!gridsMatch(submittedGrid, puzzle.solution)) {
    throw new SolveError('INCORRECT_SOLUTION', 400, 'The submitted grid is not the solution');
  }

  const timeMs = now - attempt.createdAt.getTime();
  if (isImplausiblyFast(difficulty, timeMs)) {
    throw new SolveError('TOO_FAST', 400, 'Solve time is implausibly fast');
  }

  const [updated] = await db
    .update(solveAttempts)
    .set({ completed: true, timeMs, mistakes: Math.max(0, Math.trunc(mistakes)) })
    .where(and(eq(solveAttempts.userId, userId), eq(solveAttempts.puzzleId, puzzle.id)))
    .returning();

  return updated;
}
