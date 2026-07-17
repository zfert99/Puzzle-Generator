/**
 * The Killer LOGICAL solver — solves the way a human does, applying techniques in tiers and
 * recording the hardest one required. That "hardest tier" is how the generator (K5) grades a
 * puzzle's difficulty. Distinct from the exact solver (`killer-solver.ts`), which brute-force
 * counts solutions for the uniqueness gate.
 *
 * COMPOSES `HumanSolver` (never inherits — AGENTS.md §1): it uses HumanSolver as the candidate
 * grid and drives the standalone classic-technique functions on it, interleaving Killer-specific
 * cage deductions. Being built one tier at a time — this file currently implements TIER 1.
 *
 * See `killer-logical-solver.md`.
 */

import { getGridConfig, type GridSize } from '../sudoku';
import { createEmptyGrid } from '../grid-utils';
import { HumanSolver } from '../human-solver';
import { applyNakedSingle, applyHiddenSingle } from '../strategies/basic';
import { candidateMaskFor } from './cage-combinations';
import type { Cage } from './killer-types';

/** 0 = nothing needed (already solved); 1 = Tier 1; higher tiers added later. */
export type KillerTier = 0 | 1 | 2 | 3 | 4;

export class KillerLogicalSolver {
  private readonly hs: HumanSolver;
  private readonly size: number;
  private readonly houseSum: number; // 45 for 9×9 (1+…+9)
  private readonly cages: Cage[];
  /** Every house (row, column, box) as a list of flat cell indices — each sums to houseSum. */
  private readonly houses: number[][];
  private hardestTier: KillerTier = 0;

  constructor(cages: Cage[], gridSize: GridSize, givens?: number[][]) {
    const config = getGridConfig(gridSize);
    this.size = config.size;
    this.houseSum = (this.size * (this.size + 1)) / 2;
    this.cages = cages;
    this.hs = new HumanSolver(givens ?? createEmptyGrid(config.size));
    this.houses = this.buildHouses(config.boxWidth, config.boxHeight);
  }

  /** The working grid (0 = still empty). Read after `solve`. */
  get grid(): number[][] {
    return this.hs.grid;
  }

  /** All rows, columns, and boxes as flat-index cell lists (each a full `size`-cell house). */
  private buildHouses(boxWidth: number, boxHeight: number): number[][] {
    const size = this.size;
    const houses: number[][] = [];

    for (let r = 0; r < size; r++) {
      houses.push(Array.from({ length: size }, (_, c) => r * size + c));
    }
    for (let c = 0; c < size; c++) {
      houses.push(Array.from({ length: size }, (_, r) => r * size + c));
    }
    const boxesPerRow = size / boxWidth;
    for (let b = 0; b < size; b++) {
      const boxRow = Math.floor(b / boxesPerRow);
      const boxCol = b % boxesPerRow;
      const cells: number[] = [];
      for (let dr = 0; dr < boxHeight; dr++) {
        for (let dc = 0; dc < boxWidth; dc++) {
          cells.push((boxRow * boxHeight + dr) * size + (boxCol * boxWidth + dc));
        }
      }
      houses.push(cells);
    }
    return houses;
  }

  private note(tier: KillerTier): void {
    if (tier > this.hardestTier) this.hardestTier = tier;
  }

  /**
   * Cage-combination elimination (Tier 1, foundational). For each cage, from the digits already
   * placed in it, restrict every remaining cell to the digits that can still appear —
   * `candidateMaskFor(cellsLeft, sumLeft)` minus digits already used in the cage. For a
   * single-combination ("magic") cage this fixes the cell to the combo's digits. Sound: it only
   * removes digits that cannot possibly appear (K1 arithmetic + no-repeat).
   */
  private applyCageArithmetic(): boolean {
    let changed = false;
    for (const cage of this.cages) {
      let used = 0;
      let sumLeft = cage.sum;
      const remaining: number[] = [];
      for (const cell of cage.cells) {
        const digit = this.hs.grid[Math.floor(cell / this.size)][cell % this.size];
        if (digit !== 0) {
          used |= 1 << (digit - 1);
          sumLeft -= digit;
        } else {
          remaining.push(cell);
        }
      }
      if (remaining.length === 0) continue;

      const allowed = candidateMaskFor(remaining.length, sumLeft) & ~used;
      for (const cell of remaining) {
        const r = Math.floor(cell / this.size);
        const c = cell % this.size;
        if ((this.hs.candidates[r][c] & ~allowed) !== 0) {
          this.hs.candidates[r][c] &= allowed;
          changed = true;
        }
      }
    }
    return changed;
  }

  /**
   * Single-house Rule of 45 (Tier 1). Every house sums to `houseSum`. If a house is tiled by
   * cages lying ENTIRELY within it plus exactly one leftover cell (an "innie"), that cell =
   * houseSum − (sum of the contained cages). Places it when the value is a legal candidate.
   *
   * Correctness hinges on using REAL houses (full `size`-cell rows/cols/boxes) — a partial cell
   * set would not sum to houseSum and the deduction would be unsound.
   */
  private applyRuleOf45(): boolean {
    for (const houseCellList of this.houses) {
      const houseCells = new Set(houseCellList);
      let containedSum = 0;
      const covered = new Set<number>();
      for (const cage of this.cages) {
        if (cage.cells.every((cell) => houseCells.has(cell))) {
          containedSum += cage.sum;
          for (const cell of cage.cells) covered.add(cell);
        }
      }
      if (covered.size !== houseCells.size - 1) continue;

      let target = -1;
      for (const cell of houseCells) {
        if (!covered.has(cell)) {
          target = cell;
          break;
        }
      }
      const value = this.houseSum - containedSum;
      const r = Math.floor(target / this.size);
      const c = target % this.size;
      if (value >= 1 && value <= this.size && this.hs.grid[r][c] === 0 && this.hs.hasCandidate(r, c, value)) {
        this.hs.placeNumber(r, c, value);
        return true;
      }
    }
    return false;
  }

  /**
   * Run the deduction loop until solved or stuck, cheapest technique first (so ripple effects
   * are exhausted before anything harder). Returns whether it fully solved and the hardest tier
   * it needed — the difficulty signal.
   */
  solve(): { solved: boolean; hardestTier: KillerTier } {
    let changed = true;
    while (changed && !this.hs.isSolved()) {
      changed = false;

      // ---- Tier 1 ----
      if (this.applyCageArithmetic()) { this.note(1); changed = true; continue; }
      if (applyNakedSingle(this.hs)) { this.note(1); changed = true; continue; }
      if (applyHiddenSingle(this.hs)) { this.note(1); changed = true; continue; }
      if (this.applyRuleOf45()) { this.note(1); changed = true; continue; }

      // Higher tiers land here as they're built.
    }
    return { solved: this.hs.isSolved(), hardestTier: this.hardestTier };
  }
}
