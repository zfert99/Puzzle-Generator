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

/**
 * Floor under every board's mistake bound, which is in practice **the 4×4 bound**.
 *
 * The distinct-placement count below is the right *shape* but too tight on the smallest boards to
 * absorb legitimate repetition: a 4×4 with 10 blanks admits only 30 distinct wrong placements, and
 * a flailing beginner re-entering the same wrong digit can pass that inside one bad session (the
 * board counts every wrong placement, and erasing doesn't decrement). Truncating a real player's
 * count is the failure this is sized to avoid.
 *
 * **Which boards actually sit on the floor is a fact about the ROLLER, not about size.** Measured:
 * every 4×4 lands here (7–16 blanks → 21–48, easy through caged). Among 6×6s only the *hard* tier
 * clears it (26 blanks classic → 130; 36 caged → 180) — a 6×6 easy measures 16 blanks → 80 and a
 * 6×6 medium exactly 100, both at or under the floor. That does not bite today because `recordSolve`
 * only ever sees dailies and `rollDailyAssignment` rolls a size for the `mini-hard` slot alone,
 * so every 6×6 daily is `hard`. Let `mini-easy` or `mini-medium` roll to 6×6 and those boards
 * quietly become floor-bound rather than board-derived — the same "a slot key is not an identity"
 * trap this repo has hit twice. 9×9s clear it by a wide margin either way.
 */
const MIN_MISTAKE_BOUND = 100;

/**
 * The largest mistake count worth believing from this board: the distinct wrong placements it
 * admits — every empty cell against every digit that isn't its answer, `emptyCells × (size − 1)` —
 * or {@link MIN_MISTAKE_BOUND}, whichever is larger.
 *
 * **Why a board-derived bound rather than a big constant.** `mistakes` is client-reported and
 * unverifiable, so the only question worth asking is "could a real client have produced this?".
 * The board answers it: givens can't be mistaken (they aren't editable), and an empty cell has
 * exactly `size − 1` wrong digits available. Measured against the boards actually in rotation:
 * 4×4 minis floor at 100, a 6×6 Killer runs 180, a 9×9 classic with 41 clues 320, and a caged 9×9
 * — no givens at all — 648. The ceiling this replaces was a flat 100 000, a count no board here
 * can generate; today's `mini-easy` row still carries exactly that, banked by a probe, and it is
 * served on the public leaderboard.
 *
 * **Clamped, never rejected.** Above the bound the count stops being informative, but `mistakes`
 * never touches ranking, so failing an otherwise-valid solve over a display stat would be the
 * worse outcome — the same reasoning the route has always applied, now with a number that means
 * something.
 */
export function maxPlausibleMistakes(puzzleGrid: Grid): number {
  const size = puzzleGrid.length;
  let emptyCells = 0;
  for (const row of puzzleGrid) {
    for (const value of row) if (value === 0) emptyCells++;
  }
  return Math.max(MIN_MISTAKE_BOUND, emptyCells * (size - 1));
}
