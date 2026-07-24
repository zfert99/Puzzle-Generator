/**
 * The Keisan (Calcudoku) LOGICAL solver — solves the way a human does, applying techniques in
 * tiers over rows and columns (NO boxes) and recording the hardest tier required. That "hardest
 * tier" plus the technique counts are how the generator (K4) grades difficulty. Distinct from the
 * exact solver (`calc-solver.ts`), which brute-force counts solutions; this one never guesses.
 *
 * Unlike Killer's logical solver, this does **not** compose `HumanSolver` — that class is
 * box-Sudoku-only (it applies box constraints on 4/6 and throws on 5/7). Keisan is Latin-square-
 * only, so the candidate grid and every technique here operate on rows + columns alone.
 *
 * ## Soundness
 *
 * Every technique only removes candidates / places digits that are true in ALL solutions, so a
 * completed logical solve necessarily equals the unique exact solution (fuzzed against
 * `calc-solver` in the tests). The tiers only decide *how hard* the puzzle is, never *whether* the
 * deduction is valid.
 *
 * See `calc-logical-solver.md` for the "why" and the tier ladder.
 */

import type { GridSize } from '../sudoku';
import { calcCombosFor } from './calc-combinations';
import type { CalcCage } from './calc-types';

/** Grading tiers: 0 = already solved; 1..4 as the technique ladder (see the `.md`). */
export type CalcTier = 0 | 1 | 2 | 3 | 4;

/** Every technique the deduction loop can apply, in rough priority order. */
export type CalcTechnique =
  | 'cageArithmetic'
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'nakedPair'
  | 'hiddenPair'
  | 'cageComboRestriction'
  | 'lineSum'
  | 'xWing';

const TECHNIQUE_TIER: Record<CalcTechnique, CalcTier> = {
  cageArithmetic: 1,
  nakedSingle: 1,
  hiddenSingle: 1,
  nakedPair: 2,
  hiddenPair: 2,
  cageComboRestriction: 2,
  lineSum: 3,
  xWing: 4,
};

/** Outcome of a logical solve — the grade plus the raw material for two-factor scoring (K4). */
export interface CalcSolveResult {
  solved: boolean;
  hardestTier: CalcTier;
  /** How many times each technique fired (absent = never). */
  techniqueCounts: Partial<Record<CalcTechnique, number>>;
  /** Deduction-loop iterations until solved/stuck. */
  passes: number;
  /** Mean naked singles simultaneously available per pass — opportunity density (high = open/easy). */
  avgOpenSingles: number;
}

function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    count += 1;
  }
  return count;
}

function lowestDigit(mask: number): number {
  return 32 - Math.clz32(mask & -mask); // digit d where bit === 1 << (d-1)
}

export class CalcLogicalSolver {
  private readonly size: number;
  private readonly full: number;
  private readonly cages: CalcCage[];
  private readonly cellCage: Int32Array;
  /** Precompiled valid multisets per cage, as per-digit count arrays. */
  private readonly cageCounts: Uint8Array[][];
  /** Units to scan for classic techniques: each row then each column, as flat-index lists. */
  private readonly units: number[][];

  private grid: number[][];
  private cands: number[][]; // bitmask per cell (0 once placed)
  private empties: number;
  private hardestTier: CalcTier = 0;

  constructor(cages: CalcCage[], gridSize: GridSize) {
    this.size = gridSize;
    this.full = (1 << this.size) - 1;
    this.cages = cages;
    this.cellCage = new Int32Array(this.size * this.size).fill(-1);
    cages.forEach((cage, index) => {
      for (const cell of cage.cells) this.cellCage[cell] = index;
    });
    this.cageCounts = cages.map((cage) =>
      calcCombosFor(cage.op, cage.cells.length, cage.target, this.size).map((m) => {
        const c = new Uint8Array(this.size + 1);
        for (const d of m) c[d] += 1;
        return c;
      }),
    );

    this.units = [];
    for (let r = 0; r < this.size; r++) {
      this.units.push(Array.from({ length: this.size }, (_, c) => r * this.size + c));
    }
    for (let c = 0; c < this.size; c++) {
      this.units.push(Array.from({ length: this.size }, (_, r) => r * this.size + c));
    }

    this.grid = Array.from({ length: this.size }, () => new Array<number>(this.size).fill(0));
    this.cands = Array.from({ length: this.size }, () => new Array<number>(this.size).fill(this.full));
    this.empties = this.size * this.size;

    // Single-cell cages are givens — place them immediately (the T1 "givens" step).
    for (const cage of cages) {
      if (cage.cells.length === 1) {
        const cell = cage.cells[0];
        this.place(Math.floor(cell / this.size), cell % this.size, cage.target);
      }
    }
  }

  get grid2d(): number[][] {
    return this.grid;
  }

  private rc(cell: number): [number, number] {
    return [Math.floor(cell / this.size), cell % this.size];
  }

  /** Place `digit` at (r, c) and strip it from row/column peers. */
  private place(r: number, c: number, digit: number): void {
    if (this.grid[r][c] !== 0) return;
    const bit = 1 << (digit - 1);
    this.grid[r][c] = digit;
    this.cands[r][c] = 0;
    this.empties -= 1;
    for (let i = 0; i < this.size; i++) {
      this.cands[r][i] &= ~bit;
      this.cands[i][c] &= ~bit;
    }
  }

  /** Remove `bit` from (r, c)'s candidates; return whether it changed anything. */
  private eliminate(r: number, c: number, bit: number): boolean {
    if (this.grid[r][c] !== 0 || (this.cands[r][c] & bit) === 0) return false;
    this.cands[r][c] &= ~bit;
    return true;
  }

  // ---- Tier 1: cage arithmetic + singles ------------------------------------------------------

  /** Digits already placed in a cage, as a per-digit count array. */
  private placedCounts(cage: CalcCage): Uint8Array {
    const counts = new Uint8Array(this.size + 1);
    for (const cell of cage.cells) {
      const [r, c] = this.rc(cell);
      if (this.grid[r][c] !== 0) counts[this.grid[r][c]] += 1;
    }
    return counts;
  }

  /**
   * Cheap cage arithmetic (T1): restrict each empty cell's candidates to digits that can still
   * appear somewhere in the cage — i.e. that some valid multiset (with the placed digits as a
   * sub-multiset) still needs. Over-approximating but sound; handles single-combination cages
   * (forced digits) for free.
   */
  private cageArithmetic(): boolean {
    let changed = false;
    this.cages.forEach((cage, index) => {
      if (cage.cells.length === 1) return;
      const placed = this.placedCounts(cage);
      let mask = 0;
      for (const counts of this.cageCounts[index]) {
        let isSub = true;
        for (let d = 1; d <= this.size; d++) {
          if (placed[d] > counts[d]) {
            isSub = false;
            break;
          }
        }
        if (!isSub) continue;
        for (let d = 1; d <= this.size; d++) if (counts[d] > placed[d]) mask |= 1 << (d - 1);
      }
      for (const cell of cage.cells) {
        const [r, c] = this.rc(cell);
        if (this.grid[r][c] !== 0) continue;
        const next = this.cands[r][c] & mask;
        if (next !== this.cands[r][c]) {
          this.cands[r][c] = next;
          changed = true;
        }
      }
    });
    return changed;
  }

  private nakedSingle(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0 && popcount(this.cands[r][c]) === 1) {
          this.place(r, c, lowestDigit(this.cands[r][c]));
          return true;
        }
      }
    }
    return false;
  }

  /** How many naked singles are available right now (opportunity density signal). */
  private countOpenSingles(): number {
    let n = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0 && popcount(this.cands[r][c]) === 1) n += 1;
      }
    }
    return n;
  }

  private hiddenSingle(): boolean {
    for (const unit of this.units) {
      for (let d = 1; d <= this.size; d++) {
        const bit = 1 << (d - 1);
        let pos = -1;
        let count = 0;
        for (const cell of unit) {
          const [r, c] = this.rc(cell);
          if (this.grid[r][c] === 0 && this.cands[r][c] & bit) {
            count += 1;
            pos = cell;
          }
        }
        if (count === 1) {
          const [r, c] = this.rc(pos);
          if (popcount(this.cands[r][c]) > 1) {
            this.place(r, c, d);
            return true;
          }
        }
      }
    }
    return false;
  }

  // ---- Tier 2: pairs + cage-combo restriction -------------------------------------------------

  private nakedPair(): boolean {
    for (const unit of this.units) {
      const twos: { cell: number; mask: number }[] = [];
      for (const cell of unit) {
        const [r, c] = this.rc(cell);
        if (this.grid[r][c] === 0 && popcount(this.cands[r][c]) === 2) twos.push({ cell, mask: this.cands[r][c] });
      }
      for (let i = 0; i < twos.length; i++) {
        for (let j = i + 1; j < twos.length; j++) {
          if (twos[i].mask !== twos[j].mask) continue;
          const pairMask = twos[i].mask;
          let changed = false;
          for (const cell of unit) {
            if (cell === twos[i].cell || cell === twos[j].cell) continue;
            const [r, c] = this.rc(cell);
            if (this.grid[r][c] !== 0) continue;
            if (this.eliminate(r, c, pairMask)) changed = true;
          }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  private hiddenPair(): boolean {
    for (const unit of this.units) {
      for (let d1 = 1; d1 <= this.size; d1++) {
        for (let d2 = d1 + 1; d2 <= this.size; d2++) {
          const b1 = 1 << (d1 - 1);
          const b2 = 1 << (d2 - 1);
          // Hidden pair: d1 and d2 each appear in exactly the same two empty cells of the unit.
          const cellsD1 = unit.filter((cell) => {
            const [r, c] = this.rc(cell);
            return this.grid[r][c] === 0 && this.cands[r][c] & b1;
          });
          const cellsD2 = unit.filter((cell) => {
            const [r, c] = this.rc(cell);
            return this.grid[r][c] === 0 && this.cands[r][c] & b2;
          });
          if (cellsD1.length !== 2 || cellsD2.length !== 2) continue;
          if (cellsD1[0] !== cellsD2[0] || cellsD1[1] !== cellsD2[1]) continue;
          // Confine those two cells to just {d1, d2}, removing any other candidates.
          const keep = b1 | b2;
          let changed = false;
          for (const cell of cellsD1) {
            const [r, c] = this.rc(cell);
            const next = this.cands[r][c] & keep;
            if (next !== this.cands[r][c]) {
              this.cands[r][c] = next;
              changed = true;
            }
          }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  /**
   * Cage-combo restriction (T2): the strong cage deduction. For each cage, enumerate the valid
   * multisets still consistent with placed digits, and for each try to fully place it into the
   * empty cells using only their current candidates and respecting the no-collinear-repeat rule.
   * A digit survives in an empty cell only if some full placement supports it there. Strictly
   * stronger than `cageArithmetic` (which ignores whether the OTHER cells can absorb the rest).
   */
  private cageComboRestriction(): boolean {
    let changed = false;
    this.cages.forEach((cage, index) => {
      const emptyCells = cage.cells.filter((cell) => {
        const [r, c] = this.rc(cell);
        return this.grid[r][c] === 0;
      });
      if (emptyCells.length < 2) return; // singles handled by cageArithmetic/nakedSingle
      const placed = this.placedCounts(cage);

      // supported[cellIndexInEmpty] = bitmask of digits some valid full placement puts there.
      const supported = new Array<number>(emptyCells.length).fill(0);

      for (const counts of this.cageCounts[index]) {
        // remaining multiset = counts − placed (must be ≥ 0 everywhere, else this multiset is out)
        const remaining = new Uint8Array(this.size + 1);
        let ok = true;
        for (let d = 1; d <= this.size; d++) {
          if (placed[d] > counts[d]) {
            ok = false;
            break;
          }
          remaining[d] = counts[d] - placed[d];
        }
        if (!ok) continue;
        this.collectPlacements(emptyCells, remaining, 0, [], supported);
      }

      emptyCells.forEach((cell, i) => {
        const [r, c] = this.rc(cell);
        const next = this.cands[r][c] & supported[i];
        if (next !== this.cands[r][c]) {
          this.cands[r][c] = next;
          changed = true;
        }
      });
    });
    return changed;
  }

  /**
   * Backtracking matcher for `cageComboRestriction`: assign the `remaining` multiset to
   * `emptyCells[pos..]`, each digit within the cell's candidates and equal digits never collinear.
   * Every full assignment marks its (cell → digit) choices into `supported`.
   */
  private collectPlacements(
    emptyCells: number[],
    remaining: Uint8Array,
    pos: number,
    chosen: { cell: number; digit: number }[],
    supported: number[],
  ): void {
    if (pos === emptyCells.length) {
      for (let i = 0; i < emptyCells.length; i++) supported[i] |= 1 << (chosen[i].digit - 1);
      return;
    }
    const cell = emptyCells[pos];
    const [r, c] = this.rc(cell);
    for (let d = 1; d <= this.size; d++) {
      if (remaining[d] === 0) continue;
      if ((this.cands[r][c] & (1 << (d - 1))) === 0) continue;
      // No collinear repeat: an earlier chosen cell with the same digit must not share row/col.
      let collinear = false;
      for (const prev of chosen) {
        if (prev.digit !== d) continue;
        const [pr, pc] = this.rc(prev.cell);
        if (pr === r || pc === c) {
          collinear = true;
          break;
        }
      }
      if (collinear) continue;
      remaining[d] -= 1;
      chosen.push({ cell, digit: d });
      this.collectPlacements(emptyCells, remaining, pos + 1, chosen, supported);
      chosen.pop();
      remaining[d] += 1;
    }
  }

  // ---- Tier 3: line-sum invariant -------------------------------------------------------------

  /**
   * Line-sum invariant / "Rule of 21" family (T3): every row and column sums to N(N+1)/2. If a
   * line has exactly one empty cell, its value is forced to the line total minus the placed digits.
   * (A modest first cut; multi-cell innie/outie reasoning across cages is a later refinement.)
   */
  private lineSum(): boolean {
    const lineTotal = (this.size * (this.size + 1)) / 2;
    for (const unit of this.units) {
      let placedSum = 0;
      let empty = -1;
      let emptyCount = 0;
      for (const cell of unit) {
        const [r, c] = this.rc(cell);
        if (this.grid[r][c] === 0) {
          empty = cell;
          emptyCount += 1;
        } else {
          placedSum += this.grid[r][c];
        }
      }
      if (emptyCount === 1) {
        const need = lineTotal - placedSum;
        if (need >= 1 && need <= this.size) {
          const [r, c] = this.rc(empty);
          if (this.cands[r][c] & (1 << (need - 1))) {
            this.place(r, c, need);
            return true;
          }
        }
      }
    }
    return false;
  }

  // ---- Tier 4: X-Wing on rows/columns ---------------------------------------------------------

  private xWing(): boolean {
    // Row-based: a digit confined to the same two columns in two rows → eliminate from those
    // columns elsewhere. Then the column-based transpose.
    for (let orient = 0; orient < 2; orient++) {
      const rows = orient === 0;
      for (let d = 1; d <= this.size; d++) {
        const bit = 1 << (d - 1);
        const linePositions: number[][] = [];
        for (let a = 0; a < this.size; a++) {
          const positions: number[] = [];
          for (let b = 0; b < this.size; b++) {
            const r = rows ? a : b;
            const c = rows ? b : a;
            if (this.grid[r][c] === 0 && this.cands[r][c] & bit) positions.push(b);
          }
          linePositions.push(positions);
        }
        for (let a1 = 0; a1 < this.size; a1++) {
          if (linePositions[a1].length !== 2) continue;
          for (let a2 = a1 + 1; a2 < this.size; a2++) {
            if (linePositions[a2].length !== 2) continue;
            if (linePositions[a1][0] !== linePositions[a2][0] || linePositions[a1][1] !== linePositions[a2][1]) continue;
            const [b1, b2] = linePositions[a1];
            let changed = false;
            for (let a = 0; a < this.size; a++) {
              if (a === a1 || a === a2) continue;
              for (const b of [b1, b2]) {
                const r = rows ? a : b;
                const c = rows ? b : a;
                if (this.eliminate(r, c, bit)) changed = true;
              }
            }
            if (changed) return true;
          }
        }
      }
    }
    return false;
  }

  // ---- Solve loop -----------------------------------------------------------------------------

  /**
   * Solve as far as pure logic allows, capped at `maxTier` (default 4). Applies the cheapest
   * technique that makes progress and restarts from the cheapest — so the recorded `hardestTier`
   * is the minimum ceiling the puzzle actually demands. Records technique counts and the mean
   * open-singles density for the K4 scorer.
   */
  solve({ maxTier = 4 as CalcTier }: { maxTier?: CalcTier } = {}): CalcSolveResult {
    const allTechniques: { name: CalcTechnique; run: () => boolean }[] = [
      { name: 'cageArithmetic', run: () => this.cageArithmetic() },
      { name: 'nakedSingle', run: () => this.nakedSingle() },
      { name: 'hiddenSingle', run: () => this.hiddenSingle() },
      { name: 'nakedPair', run: () => this.nakedPair() },
      { name: 'hiddenPair', run: () => this.hiddenPair() },
      { name: 'cageComboRestriction', run: () => this.cageComboRestriction() },
      { name: 'lineSum', run: () => this.lineSum() },
      { name: 'xWing', run: () => this.xWing() },
    ];
    const ladder = allTechniques.filter((t) => TECHNIQUE_TIER[t.name] <= maxTier);

    const techniqueCounts: Partial<Record<CalcTechnique, number>> = {};
    let passes = 0;
    let openSinglesSum = 0;

    while (this.empties > 0) {
      openSinglesSum += this.countOpenSingles();
      passes += 1;
      let progressed = false;
      for (const technique of ladder) {
        if (technique.run()) {
          techniqueCounts[technique.name] = (techniqueCounts[technique.name] ?? 0) + 1;
          const tier = TECHNIQUE_TIER[technique.name];
          if (tier > this.hardestTier) this.hardestTier = tier;
          progressed = true;
          break;
        }
      }
      if (!progressed) break;
    }

    return {
      solved: this.empties === 0,
      hardestTier: this.hardestTier,
      techniqueCounts,
      passes,
      avgOpenSingles: passes > 0 ? openSinglesSum / passes : 0,
    };
  }
}
