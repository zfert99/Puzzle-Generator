import type { Grid } from '@/lib/db/schema';
import { DAILY_BOARDS, type DailyDifficulty } from '@/lib/db/daily-row';

/**
 * Pure anti-cheat rules for a daily solve — no DB, no clock — so they are unit-testable
 * and live in one reviewable place. The services in this feature apply them around the
 * server-authoritative timing and grid data.
 *
 * Pragmatic posture (project decision): we keep serving the solution to the board (so
 * hints/mistake-highlighting work) and rely on these server-side checks — grid equality,
 * a plausibility floor, one attempt per user — rather than hiding the solution. A sudoku
 * is externally solvable anyway, so hiding it buys little for real cost.
 */

/** Deep-equal two grids. Used to verify a submitted grid against the stored solution. */
export function gridsMatch(a: Grid, b: Grid): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    const rowA = a[r];
    const rowB = b[r];
    if (rowA.length !== rowB.length) return false;
    for (let c = 0; c < rowA.length; c++) {
      if (rowA[c] !== rowB[c]) return false;
    }
  }
  return true;
}

/**
 * Minimum plausible solve time per difficulty (ms). A submission faster than this is
 * rejected as impossible for a human — the floor only needs to exclude instant autofill,
 * not police fast solvers, so it is set conservatively below real human records.
 */
export const MIN_SOLVE_MS: Record<DailyDifficulty, number> = {
  // Per-board floors live in the daily-board registry (single source of truth); the legacy
  // 'killer' key (pre-ladder single daily) keeps its original floor for archived replays.
  ...(Object.fromEntries(DAILY_BOARDS.map((b) => [b.key, b.minSolveMs])) as Record<DailyDifficulty, number>),
  killer: 30_000,
};

/** True if a solve time is implausibly fast for the difficulty (i.e. below the floor). */
export function isImplausiblyFast(difficulty: DailyDifficulty, timeMs: number): boolean {
  return timeMs < MIN_SOLVE_MS[difficulty];
}
