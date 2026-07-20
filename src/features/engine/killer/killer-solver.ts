/**
 * The Killer Sudoku exact solver — bitmask backtracking with an MRV heuristic, extended with
 * cage constraints. Used to (a) find a puzzle's solution and (b) COUNT solutions (stopping at
 * the 2nd) so the generator can verify a cage layout is uniquely solvable.
 *
 * Per AGENTS.md §1 this is bitmask/MRV backtracking, NOT DLX/exact-cover (the house rule
 * overrides the research's DLX default; see the Killer plan §2). Kept as a class but with no
 * inheritance; the difficulty-grading (logical) solver is a separate concern (K4).
 *
 * See `killer-solver.md` for the "why".
 */

import { getGridConfig, type GridSize } from '../sudoku';
import { candidateMaskExcluding } from './cage-combinations';
import type { Cage } from './killer-types';

/** Number of set bits in a small integer (a digit-set mask). */
function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1; // clear the lowest set bit
    count += 1;
  }
  return count;
}

export class KillerSolver {
  private readonly size: number;
  private readonly boxWidth: number;
  private readonly boxHeight: number;
  private readonly boxesPerRow: number;
  private readonly full: number; // all-digits mask, e.g. 0b111111111 for 9×9

  private readonly cages: Cage[];
  private readonly cellCage: Int32Array; // flat cell index → cage index

  // Mutable search state (bitmasks of USED digits per house; cage progress).
  private readonly grid: number[][];
  private readonly rowMask: number[];
  private readonly colMask: number[];
  private readonly boxMask: number[];
  private readonly cageUsed: number[]; // digits placed in each cage (bitmask)
  private readonly cageRemSum: number[]; // target sum still to be reached
  private readonly cageRemCells: number[]; // empty cells still in the cage

  private solution: number[][] | null = null;
  private nodesLeft = Infinity;
  private budgetExhausted = false;
  /** Search nodes consumed by the last `countSolutions`/`solve` — the budget-tuning signal. */
  nodesUsed = 0;

  /**
   * @param cages    a partition of the grid (every cell in exactly one cage)
   * @param gridSize 4 | 6 | 9 — the solver is size-generic (v1 puzzles are 9×9)
   * @param givens   optional starting digits (Killer usually has none)
   */
  constructor(cages: Cage[], gridSize: GridSize, givens?: number[][]) {
    const config = getGridConfig(gridSize);
    this.size = config.size;
    this.boxWidth = config.boxWidth;
    this.boxHeight = config.boxHeight;
    this.boxesPerRow = this.size / this.boxWidth;
    this.full = (1 << this.size) - 1;

    this.cages = cages;
    this.cellCage = new Int32Array(this.size * this.size).fill(-1);
    cages.forEach((cage, index) => {
      for (const cell of cage.cells) this.cellCage[cell] = index;
    });

    this.grid = Array.from({ length: this.size }, () => new Array<number>(this.size).fill(0));
    this.rowMask = new Array<number>(this.size).fill(0);
    this.colMask = new Array<number>(this.size).fill(0);
    this.boxMask = new Array<number>(this.size).fill(0);
    this.cageUsed = cages.map(() => 0);
    this.cageRemSum = cages.map((cage) => cage.sum);
    this.cageRemCells = cages.map((cage) => cage.cells.length);

    if (givens) {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (givens[r][c] !== 0) this.place(r, c, givens[r][c]);
        }
      }
    }
  }

  private boxIndex(r: number, c: number): number {
    return Math.floor(r / this.boxHeight) * this.boxesPerRow + Math.floor(c / this.boxWidth);
  }

  /** Place `digit` at (r, c), updating every constraint tracker. */
  private place(r: number, c: number, digit: number): void {
    const bit = 1 << (digit - 1);
    const box = this.boxIndex(r, c);
    this.grid[r][c] = digit;
    this.rowMask[r] |= bit;
    this.colMask[c] |= bit;
    this.boxMask[box] |= bit;
    const cage = this.cellCage[r * this.size + c];
    this.cageUsed[cage] |= bit;
    this.cageRemSum[cage] -= digit;
    this.cageRemCells[cage] -= 1;
  }

  /** Reverse of `place` — remove `digit` from (r, c). */
  private unplace(r: number, c: number, digit: number): void {
    const bit = 1 << (digit - 1);
    const box = this.boxIndex(r, c);
    this.grid[r][c] = 0;
    this.rowMask[r] &= ~bit;
    this.colMask[c] &= ~bit;
    this.boxMask[box] &= ~bit;
    const cage = this.cellCage[r * this.size + c];
    this.cageUsed[cage] &= ~bit;
    this.cageRemSum[cage] += digit;
    this.cageRemCells[cage] += 1;
  }

  /**
   * The legal digits for an empty cell, as a bitmask. Combines the classic Sudoku exclusions
   * (row/col/box) with the cage rule via `candidateMaskExcluding`: only digits from
   * combinations of the cage's remaining (cells, sum) that are DISJOINT from its used digits
   * (E1/P1 — the plain union mask admitted digits reachable only through combinations
   * containing an already-used digit, and those dead branches were the bulk of the thrash on
   * big loose cages). The mask never contains used digits, forces the final cell
   * (`(1, S)` → the single digit S), and reads 0 when no completion exists.
   */
  private candidates(r: number, c: number): number {
    const cage = this.cellCage[r * this.size + c];
    let mask = this.full & ~(this.rowMask[r] | this.colMask[c] | this.boxMask[this.boxIndex(r, c)]);
    mask &= candidateMaskExcluding(this.cageRemCells[cage], this.cageRemSum[cage], this.cageUsed[cage], this.size);
    return mask;
  }

  /**
   * Depth-first search from the current state, incrementing `count` for each full solution and
   * snapshotting the first into `this.solution`. Stops as soon as `count` reaches `limit`.
   * MRV: fills the empty cell with the fewest candidates next, and abandons a branch the moment
   * any empty cell has zero candidates.
   */
  private search(limit: number, count: { n: number }): void {
    // Node budget (E1/P3): a pathological layout dies in bounded time instead of thrashing.
    // Exhaustion only ever REJECTS a candidate (countSolutions returns -1) — never a false
    // "unique" — so the generator loses a little yield, never correctness.
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
          if (n <= 1) break; // 0 = dead end, 1 = forced; can't do better
        }
      }
      if (bestCount <= 1 && bestR !== -1) break;
    }

    if (bestR === -1) {
      // No empty cell remains — a complete, valid solution.
      count.n += 1;
      if (!this.solution) this.solution = this.grid.map((row) => [...row]);
      return;
    }
    if (bestCount === 0) return; // some cell can't be filled — backtrack

    let m = bestMask;
    while (m) {
      const bit = m & -m; // lowest set bit
      const digit = 32 - Math.clz32(bit); // bit === 1 << (digit-1)
      this.place(bestR, bestC, digit);
      this.search(limit, count);
      this.unplace(bestR, bestC, digit);
      if (count.n >= limit || this.budgetExhausted) return; // done, or out of budget
      m &= m - 1; // next candidate
    }
  }

  /**
   * How many solutions the puzzle has, capped at `limit` (default 2). `0` = unsolvable,
   * `1` = unique (what the generator wants), `≥2` = ambiguous. Capping makes the uniqueness
   * check cheap: it stops the instant a second solution appears.
   *
   * `nodeBudget` (search nodes, default unlimited) bounds worst-case cost for the generator:
   * if the search exhausts it, the answer is **-1** ("could not verify in budget") — callers
   * checking `=== 1` therefore reject, which is exactly the safe direction. The partial count
   * is never returned, because "1 found so far" is not "unique".
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
