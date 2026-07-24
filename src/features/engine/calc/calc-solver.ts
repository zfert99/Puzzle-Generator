/**
 * The Keisan (Calcudoku) exact solver — bitmask backtracking with an MRV heuristic over a
 * **Latin square** (rows + columns only, NO box mask), extended with cage-arithmetic pruning.
 * Used to (a) find a puzzle's solution and (b) COUNT solutions (stopping at the 2nd) so the
 * generator can verify a cage layout is uniquely solvable.
 *
 * Per AGENTS.md §1 this is bitmask/MRV backtracking, NOT DLX (the house-rule override; see the
 * plan §2). No inheritance; the difficulty-grading logical solver is a separate concern (K3).
 *
 * ## Why the geometry (repeat) layer is free
 *
 * Keisan permits a digit to repeat within a cage only if the repeats don't share a row or column.
 * That "no same-row/col repeat" rule is EXACTLY the Latin-square constraint the row/col masks
 * already enforce — two cage cells in the same row simply can't hold the same digit. So the solver
 * gets the K1 two-layer "geometric placement legality" for free from `rowMask`/`colMask`; the cage
 * layer only has to enforce the ARITHMETIC (the cage's digits form a valid multiset for its op +
 * target). The two combine per empty cell as `rowColFree & cageCandidateMask`.
 *
 * ## Cage-candidate pruning (the mandatory part)
 *
 * Each cage precomputes its valid multisets from `calc-combinations`. During search it tracks the
 * multiset of digits already placed in it (`placedCount`) and derives `cageMask` = the digits that
 * can still legally extend the placed multiset toward *some* still-reachable valid multiset. A
 * digit `d` is in `cageMask` iff some valid multiset `m` has the placed multiset as a sub-multiset
 * AND `count_m(d) > count_placed(d)` (d is still "needed"). Recomputed on every place/unplace.
 * Because each placement only admits a digit that keeps the placed multiset a sub-multiset of a
 * valid one, a fully-filled cage necessarily equals a valid multiset — no separate end check
 * needed. This pruning is mandatory: boxless grids have 2 constraining units per cell instead of
 * 3, so without it the search balloons (plan §K2).
 *
 * See `calc-solver.md` for the "why".
 */

import type { GridSize } from '../sudoku';
import { calcCombosFor } from './calc-combinations';
import type { CalcCage } from './calc-types';

/** Number of set bits in a small integer (a digit-set mask). */
function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    count += 1;
  }
  return count;
}

/** A cage's valid multisets, precompiled to per-digit counts for fast sub-multiset checks. */
interface CageCombos {
  /** One entry per valid multiset: `counts[d]` = how many of digit `d` it contains (index 1..N). */
  counts: readonly Uint8Array[];
}

export class CalcSolver {
  private readonly size: number;
  private readonly full: number; // all-digits mask, e.g. 0b1111 for N=4

  private readonly cages: CalcCage[];
  private readonly cellCage: Int32Array; // flat cell index → cage index
  private readonly cageCombos: CageCombos[]; // precompiled valid multisets per cage

  // Mutable search state.
  private readonly grid: number[][];
  private readonly rowMask: number[];
  private readonly colMask: number[];
  private readonly cagePlaced: Uint8Array[]; // per cage: count of each digit placed (index 1..N)
  private readonly cageMask: number[]; // per cage: digits that can still legally extend the cage

  private solution: number[][] | null = null;
  private nodesLeft = Infinity;
  private budgetExhausted = false;
  /** Search nodes consumed by the last `countSolutions`/`solve` — the budget-tuning signal. */
  nodesUsed = 0;

  /**
   * @param cages    a partition of the grid (every cell in exactly one cage), each with op+target
   * @param gridSize 4 | 5 | 6 | 7 | 9 — Keisan is Latin-square-only, so any size works
   * @param givens   optional starting digits (Keisan has none beyond single-cell cages)
   */
  constructor(cages: CalcCage[], gridSize: GridSize, givens?: number[][]) {
    this.size = gridSize;
    this.full = (1 << this.size) - 1;
    this.cages = cages;

    this.cellCage = new Int32Array(this.size * this.size).fill(-1);
    cages.forEach((cage, index) => {
      for (const cell of cage.cells) this.cellCage[cell] = index;
    });

    // Precompile each cage's valid multisets to count arrays (arithmetic layer only — geometry is
    // enforced by the row/col masks during search).
    this.cageCombos = cages.map((cage) => {
      const multisets = calcCombosFor(cage.op, cage.cells.length, cage.target, this.size);
      const counts = multisets.map((m) => {
        const c = new Uint8Array(this.size + 1);
        for (const d of m) c[d] += 1;
        return c;
      });
      return { counts };
    });

    this.grid = Array.from({ length: this.size }, () => new Array<number>(this.size).fill(0));
    this.rowMask = new Array<number>(this.size).fill(0);
    this.colMask = new Array<number>(this.size).fill(0);
    this.cagePlaced = cages.map(() => new Uint8Array(this.size + 1));
    this.cageMask = cages.map((_, index) => this.computeCageMask(index));

    if (givens) {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (givens[r][c] !== 0) this.place(r, c, givens[r][c]);
        }
      }
    }
  }

  /**
   * Digits that can still legally extend cage `index`: for every valid multiset that has the placed
   * multiset as a sub-multiset, the digits it still needs (`count_m(d) > count_placed(d)`). OR'd
   * across all such multisets. `0` means the cage is unsatisfiable from here — a dead branch.
   */
  private computeCageMask(index: number): number {
    const placed = this.cagePlaced[index];
    const size = this.size;
    let mask = 0;
    for (const counts of this.cageCombos[index].counts) {
      let isSubset = true;
      for (let d = 1; d <= size; d++) {
        if (placed[d] > counts[d]) {
          isSubset = false;
          break;
        }
      }
      if (!isSubset) continue;
      for (let d = 1; d <= size; d++) {
        if (counts[d] > placed[d]) mask |= 1 << (d - 1);
      }
    }
    return mask;
  }

  /** Place `digit` at (r, c), updating row/col masks and the cage's placed-multiset + mask. */
  private place(r: number, c: number, digit: number): void {
    const bit = 1 << (digit - 1);
    this.grid[r][c] = digit;
    this.rowMask[r] |= bit;
    this.colMask[c] |= bit;
    const cage = this.cellCage[r * this.size + c];
    this.cagePlaced[cage][digit] += 1;
    this.cageMask[cage] = this.computeCageMask(cage);
  }

  /** Reverse of `place`. */
  private unplace(r: number, c: number, digit: number): void {
    const bit = 1 << (digit - 1);
    this.grid[r][c] = 0;
    this.rowMask[r] &= ~bit;
    this.colMask[c] &= ~bit;
    const cage = this.cellCage[r * this.size + c];
    this.cagePlaced[cage][digit] -= 1;
    this.cageMask[cage] = this.computeCageMask(cage);
  }

  /**
   * Legal digits for an empty cell: the Latin-square exclusions (row ∪ col — no box) intersected
   * with the cell's cage's remaining-digit mask. The row/col part also enforces the cage's
   * same-row/col no-repeat rule for free (see the module header).
   */
  private candidates(r: number, c: number): number {
    const cage = this.cellCage[r * this.size + c];
    return this.full & ~(this.rowMask[r] | this.colMask[c]) & this.cageMask[cage];
  }

  /**
   * Depth-first search from the current state, counting full solutions (snapshotting the first)
   * up to `limit`. MRV: fill the empty cell with the fewest candidates next; abandon a branch the
   * moment any empty cell has zero.
   */
  private search(limit: number, count: { n: number }): void {
    this.nodesUsed += 1;
    if (this.nodesLeft-- <= 0) {
      this.budgetExhausted = true;
      return;
    }
    let bestR = -1;
    let bestC = -1;
    let bestMask = 0;
    let bestCount = Infinity;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== 0) continue;
        const mask = this.candidates(r, c);
        const n = popcount(mask);
        if (n < bestCount) {
          bestCount = n;
          bestMask = mask;
          bestR = r;
          bestC = c;
          if (n <= 1) break;
        }
      }
      if (bestCount <= 1 && bestR !== -1) break;
    }

    if (bestR === -1) {
      count.n += 1;
      if (!this.solution) this.solution = this.grid.map((row) => [...row]);
      return;
    }
    if (bestCount === 0) return; // dead end — backtrack

    let m = bestMask;
    while (m) {
      const bit = m & -m;
      const digit = 32 - Math.clz32(bit); // bit === 1 << (digit-1)
      this.place(bestR, bestC, digit);
      this.search(limit, count);
      this.unplace(bestR, bestC, digit);
      if (count.n >= limit || this.budgetExhausted) return;
      m &= m - 1;
    }
  }

  /**
   * How many solutions the puzzle has, capped at `limit` (default 2). `0` = unsolvable,
   * `1` = unique (what the generator wants), `≥2` = ambiguous. `nodeBudget` (default unlimited)
   * bounds worst-case cost: on exhaustion the answer is **-1** ("could not verify in budget"), so
   * a caller checking `=== 1` safely rejects.
   */
  countSolutions(limit = 2, nodeBudget = Infinity): number {
    const count = { n: 0 };
    this.nodesLeft = nodeBudget;
    this.budgetExhausted = false;
    this.nodesUsed = 0;
    this.search(limit, count);
    return this.budgetExhausted ? -1 : count.n;
  }

  /** The puzzle's solution grid, or `null` if there is none. Never budget-limited. */
  solve(): number[][] | null {
    if (!this.solution) {
      this.nodesLeft = Infinity;
      this.budgetExhausted = false;
      this.search(1, { n: 0 });
    }
    return this.solution;
  }
}
