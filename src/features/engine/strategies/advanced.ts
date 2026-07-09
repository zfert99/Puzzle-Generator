import type { HumanSolver } from '../human-solver';

/**
 * X-Wing (Fish Size 2):
 * Look for a specific candidate. If there are exactly TWO rows where this candidate can be placed,
 * AND those placements align in the exact same TWO columns, they form a perfect rectangle (or 'X').
 * Since the candidate must be placed in diagonally opposite corners of this rectangle, it is
 * guaranteed to occupy both of those columns. We can therefore eliminate the candidate from all
 * OTHER rows in those two columns. (And vice versa for column-based X-Wings.)
 *
 * Delegates to the generic applyFishOnAxis helper with size = 2.
 */
export function applyXWing(solver: HumanSolver): boolean {
  let changed = false;
  for (let num = 1; num <= solver.size; num++) {
    if (solver.applyFishOnAxis(num, 'row', 2)) changed = true;
    if (solver.applyFishOnAxis(num, 'col', 2)) changed = true;
  }
  return changed;
}

/**
 * Y-Wing (Wing Pattern, pivotSize 2):
 * Requires three bivalue cells. A "Pivot" cell [A, B], and two "Pincer" cells
 * [A, C] and [B, C] that each see the pivot but NOT each other.
 * Since the pivot must be A or B, one pincer is always forced to C.
 * Any cell seeing BOTH pincers can therefore never be C.
 *
 * Delegates to the generic applyWingPattern helper with pivotSize = 2.
 */
export function applyYWing(solver: HumanSolver): boolean {
  return solver.applyWingPattern(2);
}

/**
 * Swordfish (Fish Size 3):
 * A 3x3 expansion of the X-Wing. We look for a specific candidate. If there are exactly 3 rows
 * where this candidate appears in 2 or 3 spots, AND all those spots fall into exactly 3 columns
 * overall, it forms a closed loop. The candidate MUST occupy those 3 columns in those 3 rows.
 * Therefore, we can eliminate the candidate from all other rows in those 3 columns.
 * (And vice versa for column-based Swordfish.)
 *
 * Delegates to the generic applyFishOnAxis helper with size = 3.
 */
export function applySwordfish(solver: HumanSolver): boolean {
  let changed = false;
  for (let num = 1; num <= solver.size; num++) {
    if (solver.applyFishOnAxis(num, 'row', 3)) changed = true;
    if (solver.applyFishOnAxis(num, 'col', 3)) changed = true;
  }
  return changed;
}

/**
 * XYZ-Wing (Wing Pattern, pivotSize 3):
 * A "Pivot" cell with THREE candidates [A, B, C] and two bivalue "Pincer" cells
 * [A, C] and [B, C] that each see the pivot.
 * Since the pivot must be A, B, or C — in every case, one of the three cells is C.
 * Any cell seeing ALL THREE (pivot + both pincers) can therefore never be C.
 *
 * Delegates to the generic applyWingPattern helper with pivotSize = 3.
 */
export function applyXYZWing(solver: HumanSolver): boolean {
  return solver.applyWingPattern(3);
}
