import type { Grid } from '@/lib/db/schema';
import { getProfile, type Variant, type DailySize, type StandardRung } from '@/lib/db/daily-row';

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
 * Conservative default floor (ms) when a board somehow has no profile entry — should be
 * unreachable for a rolled slot (the profile-coverage test guarantees every eligible board has
 * one), so this only guards a pathological/legacy edge. Below any real board's floor, so it never
 * wrongly rejects a genuine solve; it just declines to add extra protection it can't derive.
 */
const DEFAULT_MIN_SOLVE_MS = 3_000;

/**
 * True if a solve time is implausibly fast for this board (below its plausibility floor). The
 * floor now comes from the `(variant, size, difficulty)` profile — not the slot key — because a
 * rung key like `hard` holds a different type/size each day, each with its own floor. The floor
 * only needs to exclude instant autofill, not police fast solvers, so it sits well below real
 * human records.
 */
export function isImplausiblyFast(
  variant: Variant,
  gridSize: DailySize,
  difficulty: StandardRung,
  timeMs: number,
): boolean {
  const floor = getProfile(variant, gridSize, difficulty)?.minSolveMs ?? DEFAULT_MIN_SOLVE_MS;
  return timeMs < floor;
}
