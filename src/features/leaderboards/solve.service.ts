import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts, type DailyPuzzle, type SolveAttempt } from '@/lib/db/schema';
import { difficultyForKey, type Variant, type DailySize } from '@/lib/db/daily-row';
import { getUserAttemptForPuzzle } from './attempts.service';
import { gridsMatch, isImplausiblyFast, maxPlausibleMistakes } from './solve-rules';
import type { Grid } from '@/lib/db/schema';

/**
 * Recording a ranked solve — the anti-cheat core (4.4).
 *
 * **Time is the client's in-game timer** (`elapsedTime`), which only advances while the
 * player is actively on the board. This is a deliberate, pragmatic tradeoff: it lets a player
 * pause a daily by leaving and resume later without their away-time counting against them
 * (the "save & continue" feature). A client-reported duration is inherently less trustworthy
 * than a server-measured one, so the **plausibility floor** (`isImplausiblyFast`) is the
 * guard that stays — a submitted time below the human-possible minimum for that difficulty is
 * rejected. Given this is a casual portfolio leaderboard, that tradeoff is acceptable.
 *
 * Non-negotiable regardless: the grid is **verified** against the stored solution before any
 * time is recorded, there is one ranked attempt per user per puzzle
 * (`UNIQUE(user_id, puzzle_id)`), and `userId` is always the caller's session id (BOLA, 4.3.1).
 */

export type SolveErrorCode = 'NOT_STARTED' | 'ALREADY_COMPLETED' | 'INCORRECT_SOLUTION' | 'TOO_FAST';

/**
 * Largest value `solve_attempts.time_ms` / `.mistakes` can hold — both are Postgres `integer`
 * (int4). Anything above it is a driver-level error, not a validation failure, so it escapes
 * the typed `SolveError` path and surfaces as a 500.
 */
const MAX_INT4 = 2_147_483_647;

/**
 * Force a client-supplied number into the int4 range. The route rejects an out-of-range
 * `timeMs` with a 400 *before* this (a garbage time should fail loudly, not be silently
 * recorded), so this is the last-resort guard for any other caller: a value the column cannot
 * hold gets pinned rather than blowing up mid-UPDATE. `Math.trunc` also drops fractional ms,
 * which the column would reject outright.
 */
function clampToColumn(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_INT4, Math.max(0, Math.trunc(value)));
}

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
 * already completed, wrong grid, implausibly fast, or losing a race to a concurrent submit).
 * On success, marks the attempt complete with the client-reported time — clamped to the
 * column's range and already past the plausibility floor — and returns it.
 */
export async function recordSolve(
  db: Database,
  args: {
    userId: string;
    puzzle: DailyPuzzle;
    submittedGrid: Grid;
    mistakes: number;
    /** Client-reported in-game elapsed time in ms (the board timer). */
    clientTimeMs: number;
  },
): Promise<SolveAttempt> {
  const { userId, puzzle, submittedGrid, mistakes, clientTimeMs } = args;

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

  const timeMs = clampToColumn(clientTimeMs);
  // Floor is derived from the puzzle's stored (variant, size, difficulty) — not the slot key, whose
  // type varies per day. `puzzle.difficulty` is the slot key; `difficultyForKey` maps it to the rung.
  const isTooFast = isImplausiblyFast(
    puzzle.variant as Variant,
    puzzle.grid.length as DailySize,
    difficultyForKey(puzzle.difficulty),
    timeMs,
  );
  if (isTooFast) {
    throw new SolveError('TOO_FAST', 400, 'Solve time is implausibly fast');
  }

  // Bound the reported mistake count by what this board can distinctly produce, not by what the
  // column can hold. `clampToColumn` alone kept int4 safe while still storing counts no board can
  // generate (a probe banked 100 000 on a 4×4, which the public leaderboard then served). Clamped,
  // never rejected: a cosmetic stat must not fail a real solve — see `maxPlausibleMistakes`.
  const boundedMistakes = Math.min(clampToColumn(mistakes), maxPlausibleMistakes(puzzle.grid));

  // `completed = false` in the WHERE is what actually enforces one-ranked-attempt — the read
  // above is only a cheap early rejection. Those are two separate round-trips with no
  // transaction between them (the driver is `neon-http`: stateless, no interactive
  // transaction), so two submissions racing each other both saw `completed = false` and both
  // wrote, letting a concurrent double-submit keep the better of two claimed times. A single
  // conditional UPDATE is atomic, so exactly one of the racers matches a row.
  const [updated] = await db
    .update(solveAttempts)
    .set({ completed: true, timeMs, mistakes: boundedMistakes })
    .where(
      and(
        eq(solveAttempts.userId, userId),
        eq(solveAttempts.puzzleId, puzzle.id),
        eq(solveAttempts.completed, false),
      ),
    )
    .returning();

  // No row matched despite the read above finding an incomplete attempt: another request
  // completed it in between. Same rejection the sequential path gives, so the loser of a race
  // and a plain replay are indistinguishable to the caller.
  if (!updated) {
    throw new SolveError('ALREADY_COMPLETED', 409, 'This daily has already been completed');
  }

  return updated;
}
