/**
 * The Killer LOGICAL solver — solves the way a human does, applying techniques in tiers and
 * recording the hardest one required. That "hardest tier" is how the generator (K5) grades a
 * puzzle's difficulty. Distinct from the exact solver (`killer-solver.ts`), which brute-force
 * counts solutions for the uniqueness gate; this one never guesses.
 *
 * COMPOSES `HumanSolver` (never inherits — AGENTS.md §1): it uses HumanSolver as the candidate
 * grid and drives the standalone classic-technique functions on it, interleaving Killer-specific
 * cage deductions. Built one tier at a time — currently TIER 1 + TIER 2.
 *
 * See `killer-logical-solver.md`.
 */

import { getGridConfig, type GridSize } from '../sudoku';
import { createEmptyGrid } from '../grid-utils';
import { HumanSolver } from '../human-solver';
import {
  applyNakedSingle,
  applyHiddenSingle,
  applyNakedPair,
  applyHiddenPair,
  applyPointingPairs,
} from '../strategies/basic';
import { applyXWing, applyYWing, applySwordfish, applyXYZWing } from '../strategies/advanced';
import { applyWWing, applyALSXZ, applyAIC } from '../strategies/extreme';
import { candidateMaskFor, guaranteedMaskFor } from './cage-combinations';
import type { Cage } from './killer-types';

/**
 * Grading tiers: 0 = already solved; 1 = magic cages / single-45 / singles; 2 = consistent-digit
 * / pairs; 3 = multi-unit 45 / pointing; 4 = classic advanced + extreme (X-Wing … AIC).
 *
 * Killer v1 generates only tiers 1–3 (easy/medium/hard) — measured, those are abundant and fast;
 * tier-4 puzzles that are *solvable* are a thin band and the "unsolvable-by-this-solver" fraction
 * dominates larger cages. Tier 4 is still graded (and capped) so the ladder is complete for when
 * more Killer techniques are added.
 */
export type KillerTier = 0 | 1 | 2 | 3 | 4;

/** Every technique the deduction loop can apply, in priority order. */
export type KillerTechnique =
  | 'cageArithmetic'
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'ruleOf45'
  | 'cageConsistentDigits'
  | 'nakedPair'
  | 'hiddenPair'
  | 'ruleOf45Regions'
  | 'pointingPairs'
  | 'xWing'
  | 'swordfish'
  | 'yWing'
  | 'xyzWing'
  | 'wWing'
  | 'alsXZ'
  | 'aic';

/** Outcome of a logical solve — the grade plus the raw material for two-factor scoring. */
export interface KillerSolveResult {
  solved: boolean;
  hardestTier: KillerTier;
  /** How many times each technique fired (absent = never). */
  techniqueCounts: Partial<Record<KillerTechnique, number>>;
  /** Deduction-loop iterations until solved/stuck. */
  passes: number;
  /** Mean naked singles simultaneously available per pass — opportunity density (high = open/easy). */
  avgOpenSingles: number;
}

interface CageState {
  used: number; // bitmask of digits already placed in the cage
  sumLeft: number; // target minus placed digits
  remaining: number[]; // flat indices of the cage's still-empty cells
}

export class KillerLogicalSolver {
  private readonly hs: HumanSolver;
  private readonly size: number;
  private readonly boxWidth: number;
  private readonly boxHeight: number;
  private readonly boxesPerRow: number;
  private readonly houseSum: number; // 45 for 9×9 (1+…+9)
  private readonly cages: Cage[];
  /** Flat cell index → its cage's index. */
  private readonly cellToCage: Int32Array;
  /** Every house (row, column, box) as a list of flat cell indices — each sums to houseSum. */
  private readonly houses: number[][];
  /** Regions for the multi-unit Rule of 45: unions of 1–3 contiguous rows / columns. */
  private readonly regions: { cells: Set<number>; houseCount: number }[];
  private hardestTier: KillerTier = 0;

  constructor(cages: Cage[], gridSize: GridSize, givens?: number[][]) {
    const config = getGridConfig(gridSize);
    this.size = config.size;
    this.boxWidth = config.boxWidth;
    this.boxHeight = config.boxHeight;
    this.boxesPerRow = this.size / this.boxWidth;
    this.houseSum = (this.size * (this.size + 1)) / 2;
    this.cages = cages;
    this.cellToCage = new Int32Array(this.size * this.size).fill(-1);
    cages.forEach((cage, index) => {
      for (const cell of cage.cells) this.cellToCage[cell] = index;
    });
    this.hs = new HumanSolver(givens ?? createEmptyGrid(config.size));
    this.houses = this.buildHouses();
    this.regions = this.buildRegions();
  }

  /** The working grid (0 = still empty). Read after `solve`. */
  get grid(): number[][] {
    return this.hs.grid;
  }

  /** All rows, columns, and boxes as flat-index cell lists — index 0..s-1 rows, s..2s-1 cols, 2s..3s-1 boxes. */
  private buildHouses(): number[][] {
    const size = this.size;
    const houses: number[][] = [];
    for (let r = 0; r < size; r++) houses.push(Array.from({ length: size }, (_, c) => r * size + c));
    for (let c = 0; c < size; c++) houses.push(Array.from({ length: size }, (_, r) => r * size + c));
    for (let b = 0; b < size; b++) {
      const boxRow = Math.floor(b / this.boxesPerRow);
      const boxCol = b % this.boxesPerRow;
      const cells: number[] = [];
      for (let dr = 0; dr < this.boxHeight; dr++) {
        for (let dc = 0; dc < this.boxWidth; dc++) {
          cells.push((boxRow * this.boxHeight + dr) * size + (boxCol * this.boxWidth + dc));
        }
      }
      houses.push(cells);
    }
    return houses;
  }

  /** Unions of 1–3 contiguous rows and 1–3 contiguous columns — each a whole-house region. */
  private buildRegions(): { cells: Set<number>; houseCount: number }[] {
    const size = this.size;
    const regions: { cells: Set<number>; houseCount: number }[] = [];
    for (let start = 0; start < size; start++) {
      for (let len = 1; len <= 3 && start + len <= size; len++) {
        const rowCells = new Set<number>();
        const colCells = new Set<number>();
        for (let i = start; i < start + len; i++) {
          for (let j = 0; j < size; j++) {
            rowCells.add(i * size + j); // rows `start..start+len`
            colCells.add(j * size + i); // columns `start..start+len`
          }
        }
        regions.push({ cells: rowCells, houseCount: len });
        regions.push({ cells: colCells, houseCount: len });
      }
    }
    return regions;
  }

  /** Place `value` at `cell` if it is a legal, currently-open candidate. Returns whether it did. */
  private tryPlace(cell: number, value: number): boolean {
    const r = Math.floor(cell / this.size);
    const c = cell % this.size;
    if (value >= 1 && value <= this.size && this.hs.grid[r][c] === 0 && this.hs.hasCandidate(r, c, value)) {
      this.hs.placeNumber(r, c, value);
      return true;
    }
    return false;
  }

  private boxIndex(cell: number): number {
    const r = Math.floor(cell / this.size);
    const c = cell % this.size;
    return Math.floor(r / this.boxHeight) * this.boxesPerRow + Math.floor(c / this.boxWidth);
  }

  /** Placed digits, remaining sum, and remaining empty cells of a cage in the current grid. */
  private cageState(cage: Cage): CageState {
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
    return { used, sumLeft, remaining };
  }

  private note(tier: KillerTier): void {
    if (tier > this.hardestTier) this.hardestTier = tier;
  }

  /**
   * Cage-combination elimination (Tier 1, foundational). Restrict each cage's remaining cells to
   * `candidateMaskFor(cellsLeft, sumLeft)` minus digits already used — a magic cage fixes its
   * cells to the combo's digits. Sound: only removes arithmetically-impossible / repeated digits.
   */
  private applyCageArithmetic(): boolean {
    let changed = false;
    for (const cage of this.cages) {
      const { used, sumLeft, remaining } = this.cageState(cage);
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
   * Single-house Rule of 45 (Tier 1). If cages lying ENTIRELY within a house cover all but one
   * cell (an "innie"), that cell = houseSum − (sum of those cages). Sound only on real houses.
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
   * Consistent-digit / cage-locked-candidate (Tier 2). A digit `guaranteedMaskFor` says appears
   * in EVERY completion of a cage must sit somewhere in that cage. If all the cage cells that can
   * still hold it share a house, it can be eliminated from the rest of that house.
   *
   * Sound: `guaranteedMaskFor(cellsLeft, sumLeft)` is a subset of the true guaranteed set (it
   * ignores no-repeat, only shrinking the claim), so every digit treated as guaranteed really is.
   */
  private applyCageConsistentDigits(): boolean {
    let changed = false;
    for (const cage of this.cages) {
      const { used, sumLeft, remaining } = this.cageState(cage);
      if (remaining.length === 0) continue;

      let guaranteed = guaranteedMaskFor(remaining.length, sumLeft) & ~used;
      while (guaranteed) {
        const bit = guaranteed & -guaranteed;
        const digit = 32 - Math.clz32(bit);
        guaranteed &= guaranteed - 1;

        const cellsWithDigit = remaining.filter((cell) =>
          this.hs.hasCandidate(Math.floor(cell / this.size), cell % this.size, digit),
        );
        if (cellsWithDigit.length === 0) continue;

        // If those cells all share a house, the digit is locked into the cage there.
        const sameRow = cellsWithDigit.every((cell) => Math.floor(cell / this.size) === Math.floor(cellsWithDigit[0] / this.size));
        const sameCol = cellsWithDigit.every((cell) => cell % this.size === cellsWithDigit[0] % this.size);
        const sameBox = cellsWithDigit.every((cell) => this.boxIndex(cell) === this.boxIndex(cellsWithDigit[0]));

        const except = new Set(cellsWithDigit);
        if (sameRow) changed = this.eliminateFromHouse(this.houses[Math.floor(cellsWithDigit[0] / this.size)], digit, except) || changed;
        if (sameCol) changed = this.eliminateFromHouse(this.houses[this.size + (cellsWithDigit[0] % this.size)], digit, except) || changed;
        if (sameBox) changed = this.eliminateFromHouse(this.houses[2 * this.size + this.boxIndex(cellsWithDigit[0])], digit, except) || changed;
      }
    }
    return changed;
  }

  /** Remove `digit` from every cell of a house except those in `except`. */
  private eliminateFromHouse(houseCells: number[], digit: number, except: Set<number>): boolean {
    let changed = false;
    for (const cell of houseCells) {
      if (except.has(cell)) continue;
      if (this.hs.removeCandidate(Math.floor(cell / this.size), cell % this.size, digit)) changed = true;
    }
    return changed;
  }

  /**
   * Multi-unit Rule of 45 (Tier 3) — innies and outies over regions that are unions of complete
   * houses (so their total is `houseSum × houseCount`). For a region R:
   *   sum(R) = total  ⇒  a single "innie" cell (in R, part of a cage straddling out) = total −
   *   (sum of cages fully inside R); and a single "outie" cell (outside R, part of a cage
   *   reaching in) = (sum of all cages touching R) − total.
   * Places whichever leftover is a single cell. Single-house innies are left to Tier 1, so only
   * multi-house innies count here; outies (which Tier 1 doesn't do) fire on any region.
   */
  private applyRuleOf45Regions(): boolean {
    for (const region of this.regions) {
      const total = this.houseSum * region.houseCount;
      const touching = new Set<number>();
      for (const cell of region.cells) touching.add(this.cellToCage[cell]);

      let touchingSum = 0;
      let containedSum = 0;
      const containedCells = new Set<number>();
      const outieCells: number[] = [];
      for (const cageIndex of touching) {
        const cage = this.cages[cageIndex];
        touchingSum += cage.sum;
        if (cage.cells.every((cell) => region.cells.has(cell))) {
          containedSum += cage.sum;
          for (const cell of cage.cells) containedCells.add(cell);
        } else {
          for (const cell of cage.cells) if (!region.cells.has(cell)) outieCells.push(cell);
        }
      }

      const innieCells: number[] = [];
      for (const cell of region.cells) if (!containedCells.has(cell)) innieCells.push(cell);

      if (region.houseCount >= 2 && innieCells.length === 1) {
        if (this.tryPlace(innieCells[0], total - containedSum)) return true;
      }
      if (outieCells.length === 1) {
        if (this.tryPlace(outieCells[0], touchingSum - total)) return true;
      }
    }
    return false;
  }

  /** How many naked singles are simultaneously available — the "openness" of the current state. */
  private countOpenSingles(): number {
    let open = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.hs.grid[r][c] !== 0) continue;
        const mask = this.hs.candidates[r][c];
        if (mask !== 0 && (mask & (mask - 1)) === 0) open += 1;
      }
    }
    return open;
  }

  /**
   * Run the deduction loop until solved or stuck, cheapest technique first (so ripple effects are
   * exhausted before anything harder), recording the hardest tier that unsticks it — the grade.
   *
   * `maxTier` caps which techniques may run (default 4 = all). The generator passes the *target*
   * tier so that grading a would-be "medium" never pays for the expensive Tier-4 strategies: a
   * puzzle needing more than `maxTier` simply comes back `solved: false`, which is a reject.
   *
   * The result carries the raw material for two-factor difficulty scoring (`killer-score.ts`):
   * per-technique application counts (how much of WHAT work) and the mean number of naked singles
   * simultaneously available across passes (opportunity density — many parallel moves = an open,
   * forgiving grid; a bottlenecked grid forces one narrow path and plays harder). Openness is
   * sampled at each pass start for one popcount-scan of the grid (~µs), keeping grading cheap.
   */
  solve(options: { maxTier?: KillerTier } = {}): KillerSolveResult {
    const cap = options.maxTier ?? 4;
    const techniques: { name: KillerTechnique; tier: KillerTier; apply: () => boolean }[] = [
      { name: 'cageArithmetic', tier: 1, apply: () => this.applyCageArithmetic() },
      { name: 'nakedSingle', tier: 1, apply: () => applyNakedSingle(this.hs) },
      { name: 'hiddenSingle', tier: 1, apply: () => applyHiddenSingle(this.hs) },
      { name: 'ruleOf45', tier: 1, apply: () => this.applyRuleOf45() },
      { name: 'cageConsistentDigits', tier: 2, apply: () => this.applyCageConsistentDigits() },
      { name: 'nakedPair', tier: 2, apply: () => applyNakedPair(this.hs) },
      { name: 'hiddenPair', tier: 2, apply: () => applyHiddenPair(this.hs) },
      { name: 'ruleOf45Regions', tier: 3, apply: () => this.applyRuleOf45Regions() },
      { name: 'pointingPairs', tier: 3, apply: () => applyPointingPairs(this.hs) },
      { name: 'xWing', tier: 4, apply: () => applyXWing(this.hs) },
      { name: 'swordfish', tier: 4, apply: () => applySwordfish(this.hs) },
      { name: 'yWing', tier: 4, apply: () => applyYWing(this.hs) },
      { name: 'xyzWing', tier: 4, apply: () => applyXYZWing(this.hs) },
      { name: 'wWing', tier: 4, apply: () => applyWWing(this.hs) },
      { name: 'alsXZ', tier: 4, apply: () => applyALSXZ(this.hs) },
      { name: 'aic', tier: 4, apply: () => applyAIC(this.hs) },
    ];

    const techniqueCounts: Partial<Record<KillerTechnique, number>> = {};
    let passes = 0;
    let opennessTotal = 0;

    let changed = true;
    while (changed && !this.hs.isSolved()) {
      changed = false;
      passes += 1;
      opennessTotal += this.countOpenSingles();

      for (const technique of techniques) {
        if (technique.tier > cap) break; // table is tier-ordered; nothing further may run
        if (technique.tier === 4 && this.size !== 9) break;
        if (technique.apply()) {
          this.note(technique.tier);
          techniqueCounts[technique.name] = (techniqueCounts[technique.name] ?? 0) + 1;
          changed = true;
          break; // restart from the cheapest technique so ripple effects are exhausted first
        }
      }
    }

    return {
      solved: this.hs.isSolved(),
      hardestTier: this.hardestTier,
      techniqueCounts,
      passes,
      avgOpenSingles: passes > 0 ? opennessTotal / passes : 0,
    };
  }
}
