/**
 * The Kakuro LOGICAL solver — solves the way a human does, applying named techniques in tiers
 * and recording the hardest one required. That "hardest tier" is the puzzle's grade (Simonis:
 * the weakest technique level that finishes search-free), the per-step record is what the Hint
 * button explains, and the instrumentation set (Mathimagics' `fixed` / `implied` / `rating`)
 * is what the generator will calibrate against. Distinct from the exact solver
 * (`kakuro-solver.ts`), which counts solutions for the uniqueness gate; this one never guesses.
 *
 * A class, with no inheritance (AGENTS.md §1): the candidate state is genuinely stateful and
 * every technique reads and writes it. Tiers 1–3 are the technique ladder (E2a); tiers 4–5 are
 * forcing chains by length over the redundant-variable model (`kakuro-chains.ts`, E2b). A
 * puzzle needing a chain longer than the tier-5 bound comes back `solved: false` and ungraded
 * rather than guessed at.
 *
 * See `kakuro-logical-solver.md` for the "why" of each technique and the tier boundaries.
 */

import { maskToDigits, popcount } from '../grid-utils';
import { findFirstChainElimination, type ChainContext } from './kakuro-chains';
import { ALL_DIGITS_MASK, runComboMasks } from './kakuro-combinations';
import type { KakuroShape } from './kakuro-solver';
import type { KakuroDifficulty, Run } from './kakuro-types';

/** 0 = already solved; 1–3 = the technique ladder; 4–5 = forcing chains by length (E2b). */
export type KakuroTier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Chain-length bounds: a chain of at most `CHAIN_TIER4_MAX_LENGTH` forced truths is tier 4
 * (expert); anything longer, up to `CHAIN_TIER5_MAX_LENGTH`, is tier 5 (extreme). Provisional —
 * set from where the two `*_CHAINS` fixtures land; E5 recalibrates against measured
 * distributions and the plan's "T4 must be populated" gate.
 */
export const CHAIN_TIER4_MAX_LENGTH = 4;
export const CHAIN_TIER5_MAX_LENGTH = 12;

/** Every technique the deduction loop can apply, in priority order. */
export type KakuroTechnique =
  | 'comboRestriction'
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'feasibleCombos'
  | 'nakedSubset'
  | 'hiddenSubset'
  | 'sumBounds'
  | 'runAssignments'
  | 'shortChain'
  | 'longChain';

/** The tier each technique belongs to — the ladder (plan §1, research). */
export const TECHNIQUE_TIER: Record<KakuroTechnique, KakuroTier> = {
  comboRestriction: 1,
  nakedSingle: 1,
  hiddenSingle: 2,
  feasibleCombos: 2,
  nakedSubset: 3,
  hiddenSubset: 3,
  sumBounds: 3,
  runAssignments: 3,
  shortChain: 4,
  longChain: 5,
};

/** The tier → published difficulty map. Provisional until E5 calibrates it against measurements. */
export const TIER_DIFFICULTY: Record<Exclude<KakuroTier, 0>, Exclude<KakuroDifficulty, 'unrated'>> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
  4: 'expert',
  5: 'extreme',
};

/** One deduction, as a human would describe it. */
export interface KakuroStep {
  technique: KakuroTechnique;
  tier: KakuroTier;
  /** The run the deduction was made in (its index in `shape.runs`). */
  run: number;
  /** A digit placed by this step, if it placed one. */
  placed?: { cell: number; digit: number };
  /** Candidate masks removed, per cell (bit `d − 1` = digit `d`). */
  eliminated: { cell: number; mask: number }[];
  /** Plain-English reason, e.g. "16-in-two: only {7,9}". */
  explanation: string;
}

/** Mathimagics' instrumentation set (plan §1) — what proves a tier. */
export interface KakuroMetrics {
  /** NCELL — white cells. */
  whiteCells: number;
  /** MRL — the longest run. */
  maxRunLength: number;
  /** ACRL — mean over white cells of the average of their two runs' lengths. */
  avgCellRunLength: number;
  /** Black cells over all interior cells. */
  blackDensity: number;
  /** `runLengthHistogram[L]` = runs of length L. */
  runLengthHistogram: number[];
  /** Runs with exactly one combination for their (length, sum). */
  uniqueComboRuns: number;
  /** Cells solved by tier 1 alone (static restriction + naked singles). */
  fixed: number;
  /** Cells solved by tiers 1–2 (iterated shaving). */
  implied: number;
  /** Mean candidates per white cell after the tier-1–2 pass; 1.0 = solved by shaving alone. */
  rating: number;
}

/** Outcome of a logical solve — the grade plus the raw material for scoring and explaining. */
export interface KakuroSolveResult {
  solved: boolean;
  /** The grid as it stands contradicts itself (only possible from a player's grid). */
  contradiction: boolean;
  hardestTier: KakuroTier;
  /** How many times each technique fired (absent = never). */
  techniqueCounts: Partial<Record<KakuroTechnique, number>>;
  /** Deduction-loop iterations until solved/stuck. */
  passes: number;
  /** Mean naked singles simultaneously available per pass — opportunity density. */
  avgOpenSingles: number;
  /** Every deduction in order (empty unless `recordSteps`). */
  steps: KakuroStep[];
}

const DIGIT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function setText(mask: number): string {
  return `{${maskToDigits(mask).join(',')}}`;
}

/** The human name of a run's remaining work: "16-in-two" (sum left over the cells left). */
function runText(residual: number, remaining: number): string {
  return `${residual}-in-${DIGIT_WORDS[remaining] ?? remaining}`;
}

export class KakuroLogicalSolver {
  private readonly size: number;
  private readonly runs: readonly Run[];
  /** Flat cell → [across run index, down run index], −1 when none. */
  private readonly cellRuns: Int32Array;
  private readonly whites: number[];
  private readonly masks: Int32Array;
  private readonly placed: Uint8Array;
  private hardestTier: KakuroTier = 0;
  private contradiction = false;
  private steps: KakuroStep[] = [];

  /**
   * @param shape the puzzle's size and runs
   * @param grid digits already placed (0 = empty), e.g. a player's grid; omitted = empty board.
   *   Placed digits are trusted as-is — a wrong one surfaces as `contradiction`, never as a guess.
   */
  constructor(shape: KakuroShape, grid?: readonly number[][]) {
    this.size = shape.gridSize;
    this.runs = shape.runs;
    const cellCount = this.size * this.size;
    this.cellRuns = new Int32Array(cellCount * 2).fill(-1);
    shape.runs.forEach((run, index) => {
      const slot = run.dir === 'across' ? 0 : 1;
      for (const cell of run.cells) this.cellRuns[cell * 2 + slot] = index;
    });
    this.whites = [];
    for (let cell = 0; cell < cellCount; cell++) {
      if (this.cellRuns[cell * 2] !== -1 || this.cellRuns[cell * 2 + 1] !== -1) this.whites.push(cell);
    }
    this.masks = new Int32Array(cellCount);
    this.placed = new Uint8Array(cellCount);
    for (const cell of this.whites) {
      const digit = grid ? grid[Math.floor(cell / this.size)][cell % this.size] : 0;
      this.masks[cell] = digit > 0 ? 1 << (digit - 1) : ALL_DIGITS_MASK;
      this.placed[cell] = digit > 0 ? 1 : 0;
    }
    // A placed digit is already absent from its run-mates — the all-different rule, applied
    // once up front so every technique can assume it.
    for (const cell of this.whites) if (this.placed[cell]) this.stripFromMates(cell, this.masks[cell]);
    // Placed digits are trusted, not assumed consistent: a run holding the same digit twice, or
    // a fully-placed run with the wrong sum, is a contradiction right now — no technique below
    // would ever revisit a run with no empty cells, so it is checked here (a review finding).
    for (let r = 0; r < this.runs.length; r++) {
      let seen = 0;
      let remaining = 0;
      let total = 0;
      for (const cell of this.runs[r].cells) {
        if (!this.placed[cell]) {
          remaining++;
          continue;
        }
        const bit = this.masks[cell];
        if ((seen & bit) !== 0) this.contradiction = true;
        seen |= bit;
        total += 32 - Math.clz32(bit);
      }
      if (remaining === 0 && total !== this.runs[r].sum) this.contradiction = true;
      if (total > this.runs[r].sum) this.contradiction = true;
    }
  }

  // ---- state helpers ----

  private note(tier: KakuroTier): void {
    if (tier > this.hardestTier) this.hardestTier = tier;
  }

  private runOf(cell: number, slot: 0 | 1): number {
    return this.cellRuns[cell * 2 + slot];
  }

  /** The unplaced cells of a run, the digits already placed in it, and the sum left to make. */
  private remainingOf(runIndex: number): { cells: number[]; used: number; residual: number } {
    const run = this.runs[runIndex];
    const cells: number[] = [];
    let used = 0;
    let residual = run.sum;
    for (const cell of run.cells) {
      if (this.placed[cell]) {
        used |= this.masks[cell];
        residual -= 32 - Math.clz32(this.masks[cell]);
      } else {
        cells.push(cell);
      }
    }
    return { cells, used, residual };
  }

  /** The combination masks for a run's remaining work that avoid its already-placed digits. */
  private openCombos(runIndex: number): { cells: number[]; used: number; residual: number; combos: number[] } {
    const state = this.remainingOf(runIndex);
    const combos: number[] = [];
    for (const combo of runComboMasks(state.cells.length, state.residual)) {
      if ((combo & state.used) === 0) combos.push(combo);
    }
    return { ...state, combos };
  }

  /** Remove `mask` from every unplaced run-mate of `cell`, in both its runs. */
  private stripFromMates(cell: number, mask: number): void {
    for (const slot of [0, 1] as const) {
      const runIndex = this.runOf(cell, slot);
      if (runIndex === -1) continue;
      for (const mate of this.runs[runIndex].cells) {
        if (mate !== cell && !this.placed[mate]) this.masks[mate] &= ~mask;
      }
    }
  }

  /** Restrict a cell to `mask`; returns the digits removed (0 = nothing changed). */
  private restrict(cell: number, mask: number): number {
    const before = this.masks[cell];
    const after = before & mask;
    if (after === before) return 0;
    this.masks[cell] = after;
    if (after === 0) this.contradiction = true;
    return before & ~after;
  }

  private place(cell: number, digit: number): void {
    this.masks[cell] = 1 << (digit - 1);
    this.placed[cell] = 1;
    this.stripFromMates(cell, this.masks[cell]);
  }

  /** A run named by its remaining work AND where it is: "16-in-two across (row 3)". */
  private runLabel(runIndex: number, residual: number, remaining: number): string {
    const run = this.runs[runIndex];
    const first = run.cells[0];
    const where = run.dir === 'across' ? `row ${Math.floor(first / this.size) + 1}` : `column ${(first % this.size) + 1}`;
    return `${runText(residual, remaining)} ${run.dir} (${where})`;
  }

  private cellText(cell: number): string {
    return `row ${Math.floor(cell / this.size) + 1}, column ${(cell % this.size) + 1}`;
  }

  /** Both of a cell's runs described as they stand: "across 16-in-two {7,9}; down 17-in-two {8,9}". */
  private runsText(cell: number): string {
    const parts: string[] = [];
    for (const slot of [0, 1] as const) {
      const runIndex = this.runOf(cell, slot);
      if (runIndex === -1) continue;
      const { cells, residual } = this.remainingOf(runIndex);
      parts.push(`${slot === 0 ? 'across' : 'down'} ${runText(residual, cells.length)}`);
    }
    return parts.join('; ');
  }

  // ---- techniques (each makes at most ONE deduction and returns whether it did) ----

  /**
   * Combination restriction (tier 1). A run's remaining cells can only hold digits that appear
   * in some combination for the sum still to make over the cells still empty, avoiding the
   * digits already placed in it. When that set is a single combination ("16-in-two: only
   * {7,9}") this is the classic magic-run opening; the residual form is the same rule after
   * some cells are filled.
   */
  private applyComboRestriction(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const { cells, residual, combos } = this.openCombos(r);
      if (cells.length === 0) continue;
      let union = 0;
      for (const combo of combos) union |= combo;
      const eliminated: { cell: number; mask: number }[] = [];
      for (const cell of cells) {
        const removed = this.restrict(cell, union);
        if (removed) eliminated.push({ cell, mask: removed });
      }
      if (eliminated.length > 0) {
        const unique = combos.length === 1;
        return {
          technique: 'comboRestriction',
          tier: 1,
          run: r,
          eliminated,
          explanation: `${this.runLabel(r, residual, cells.length)}: ${unique ? 'only' : 'digits from'} ${setText(union)}`,
        };
      }
    }
    return null;
  }

  /** Naked single (tier 1): an empty cell with one candidate left takes it. */
  private applyNakedSingle(): KakuroStep | null {
    for (const cell of this.whites) {
      const step = this.placeIfSingle(cell);
      if (step) return step;
    }
    return null;
  }

  /** The naked-single step for ONE cell, if it is empty and down to one candidate. */
  private placeIfSingle(cell: number): KakuroStep | null {
    if (this.placed[cell] || popcount(this.masks[cell]) !== 1) return null;
    const digit = 32 - Math.clz32(this.masks[cell]);
    const reason = this.runsText(cell);
    this.place(cell, digit);
    return {
      technique: 'nakedSingle',
      tier: 1,
      run: this.runOf(cell, 0) !== -1 ? this.runOf(cell, 0) : this.runOf(cell, 1),
      placed: { cell, digit },
      eliminated: [],
      explanation: `Only ${digit} fits at ${this.cellText(cell)} (${reason})`,
    };
  }

  /**
   * Hidden single (tier 2): a digit every remaining combination of a run needs, which only one
   * of the run's empty cells can still take — that cell must be it.
   */
  private applyHiddenSingle(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const step = this.hiddenSingleIn(r);
      if (step) return step;
    }
    return null;
  }

  /** The hidden-single step in ONE run, optionally only if it lands on `onlyCell`. */
  private hiddenSingleIn(r: number, onlyCell = -1): KakuroStep | null {
    const { cells, residual, combos } = this.openCombos(r);
    if (cells.length < 2 || combos.length === 0) return null;
    let required = ALL_DIGITS_MASK;
    for (const combo of combos) required &= combo;
    for (const digit of maskToDigits(required)) {
      const bit = 1 << (digit - 1);
      const holders = cells.filter((cell) => (this.masks[cell] & bit) !== 0);
      if (holders.length !== 1 || this.masks[holders[0]] === bit) continue;
      const cell = holders[0];
      if (onlyCell !== -1 && cell !== onlyCell) continue;
      this.place(cell, digit);
      return {
        technique: 'hiddenSingle',
        tier: 2,
        run: r,
        placed: { cell, digit },
        eliminated: [],
        explanation: `${this.runLabel(r, residual, cells.length)} needs a ${digit}, and only ${this.cellText(cell)} can take it`,
      };
    }
    return null;
  }

  /**
   * Feasible combinations (tier 2) — Simonis' domain shaving. Of a run's remaining
   * combinations, keep only those every digit of which some empty cell can still take and
   * that leave every empty cell at least one digit; the cells are then limited to the union of
   * what survives. Tier 1 looks at the (sum, count) alone; this one cross-references what the
   * crossing runs have already ruled out.
   */
  private applyFeasibleCombos(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const { cells, residual, combos } = this.openCombos(r);
      if (cells.length < 2) continue;
      let cellsUnion = 0;
      for (const cell of cells) cellsUnion |= this.masks[cell];
      let union = 0;
      for (const combo of combos) {
        if ((combo & ~cellsUnion) !== 0) continue;
        if (cells.every((cell) => (this.masks[cell] & combo) !== 0)) union |= combo;
      }
      const eliminated: { cell: number; mask: number }[] = [];
      for (const cell of cells) {
        const removed = this.restrict(cell, union);
        if (removed) eliminated.push({ cell, mask: removed });
      }
      if (eliminated.length > 0) {
        return {
          technique: 'feasibleCombos',
          tier: 2,
          run: r,
          eliminated,
          explanation: `${this.runLabel(r, residual, cells.length)}: with what the crossing runs allow, only ${setText(union)} can be used`,
        };
      }
    }
    return null;
  }

  /**
   * Naked pair / triple (tier 3): k empty cells of a run whose candidates together are exactly k
   * digits claim those digits — the run's other cells lose them.
   */
  private applyNakedSubset(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const { cells, residual } = this.remainingOf(r);
      if (cells.length < 3) continue;
      for (const k of [2, 3]) {
        if (cells.length <= k) continue;
        const found = this.findNakedSubset(r, cells, residual, k);
        if (found) return found;
      }
    }
    return null;
  }

  private findNakedSubset(r: number, cells: number[], residual: number, k: number): KakuroStep | null {
    const n = cells.length;
    const pick = (start: number, chosen: number[], union: number): KakuroStep | null => {
      if (chosen.length === k) {
        if (popcount(union) !== k) return null;
        const eliminated: { cell: number; mask: number }[] = [];
        for (const cell of cells) {
          if (chosen.includes(cell)) continue;
          const removed = this.restrict(cell, ~union);
          if (removed) eliminated.push({ cell, mask: removed });
        }
        if (eliminated.length === 0) return null;
        return {
          technique: 'nakedSubset',
          tier: 3,
          run: r,
          eliminated,
          explanation: `${this.runLabel(r, residual, n)}: ${k === 2 ? 'two' : 'three'} cells share exactly ${setText(union)}, so the others cannot use them`,
        };
      }
      for (let i = start; i < n; i++) {
        const mask = this.masks[cells[i]];
        if (popcount(mask) > k || popcount(union | mask) > k) continue;
        const found = pick(i + 1, [...chosen, cells[i]], union | mask);
        if (found) return found;
      }
      return null;
    };
    return pick(0, [], 0);
  }

  /**
   * Hidden pair (tier 3): two digits that the run MUST contain (every remaining combination has
   * both) and that can only sit in the same two empty cells — those cells are limited to the
   * pair. The "must contain" part is what makes this sound in Kakuro: unlike a Sudoku house, a
   * run need not hold any particular digit, so a pair of merely-possible digits confined to two
   * cells proves nothing. (The first draft skipped that check and placed a wrong digit on the
   * 7×7 fixture — caught by the soundness run before any test existed.)
   */
  private applyHiddenSubset(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const { cells, residual, combos } = this.openCombos(r);
      if (cells.length < 3 || combos.length === 0) continue;
      let required = ALL_DIGITS_MASK;
      for (const combo of combos) required &= combo;
      const holders = new Map<number, number[]>();
      for (const d of maskToDigits(required)) {
        const bit = 1 << (d - 1);
        const cellsWith = cells.filter((cell) => (this.masks[cell] & bit) !== 0);
        if (cellsWith.length === 2) holders.set(d, cellsWith);
      }
      const digits = [...holders.keys()];
      for (let i = 0; i < digits.length; i++) {
        for (let j = i + 1; j < digits.length; j++) {
          const a = holders.get(digits[i]) as number[];
          const b = holders.get(digits[j]) as number[];
          if (a[0] !== b[0] || a[1] !== b[1]) continue;
          const pair = (1 << (digits[i] - 1)) | (1 << (digits[j] - 1));
          const eliminated: { cell: number; mask: number }[] = [];
          for (const cell of a) {
            const removed = this.restrict(cell, pair);
            if (removed) eliminated.push({ cell, mask: removed });
          }
          if (eliminated.length === 0) continue;
          return {
            technique: 'hiddenSubset',
            tier: 3,
            run: r,
            eliminated,
            explanation: `${this.runLabel(r, residual, cells.length)} must contain ${digits[i]} and ${digits[j]}, which can only go in the same two cells — so those cells hold nothing else`,
          };
        }
      }
    }
    return null;
  }

  /**
   * Sum bounds (tier 3): a candidate is impossible if, with it placed, the run's other empty
   * cells could not make the rest of the sum — their smallest candidates add to more than what
   * is left, or their largest to less. Bounds ignore mutual distinctness (looser, still sound).
   */
  private applySumBounds(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const { cells, residual } = this.remainingOf(r);
      if (cells.length < 2) continue;
      for (const cell of cells) {
        let removed = 0;
        for (const digit of maskToDigits(this.masks[cell])) {
          const left = residual - digit;
          let lo = 0;
          let hi = 0;
          let possible = true;
          for (const other of cells) {
            if (other === cell) continue;
            const options = this.masks[other] & ~(1 << (digit - 1));
            if (options === 0) {
              possible = false;
              break;
            }
            lo += 32 - Math.clz32(options & -options);
            hi += 32 - Math.clz32(options);
          }
          if (!possible || left < lo || left > hi) removed |= 1 << (digit - 1);
        }
        if (removed !== 0) {
          this.restrict(cell, ~removed);
          return {
            technique: 'sumBounds',
            tier: 3,
            run: r,
            eliminated: [{ cell, mask: removed }],
            explanation: `${this.runLabel(r, residual, cells.length)}: ${setText(removed)} at ${this.cellText(cell)} would leave the other cells a sum they cannot make`,
          };
        }
      }
    }
    return null;
  }

  /**
   * Run assignments (tier 3) — limited-solution-set reasoning. For a short run, enumerate every
   * way its empty cells can actually be filled (distinct digits from their current candidates,
   * summing to what is left); a candidate that appears in no fill is gone. This is the exact,
   * assignment-level form of what tier 2 approximates at the digit-set level.
   */
  private applyRunAssignments(): KakuroStep | null {
    for (let r = 0; r < this.runs.length; r++) {
      const { cells, residual } = this.remainingOf(r);
      if (cells.length < 2 || cells.length > 5) continue;
      const unions = new Array<number>(cells.length).fill(0);
      let fills = 0;
      const assign = (i: number, usedMask: number, left: number, chosen: number[]): void => {
        if (fills > 5000) return;
        if (i === cells.length) {
          if (left !== 0) return;
          fills++;
          chosen.forEach((d, j) => (unions[j] |= 1 << (d - 1)));
          return;
        }
        for (const digit of maskToDigits(this.masks[cells[i]] & ~usedMask)) {
          if (digit > left) break;
          assign(i + 1, usedMask | (1 << (digit - 1)), left - digit, [...chosen, digit]);
        }
      };
      assign(0, 0, residual, []);
      if (fills > 5000) continue;
      const eliminated: { cell: number; mask: number }[] = [];
      cells.forEach((cell, j) => {
        const removed = this.restrict(cell, unions[j]);
        if (removed) eliminated.push({ cell, mask: removed });
      });
      if (eliminated.length > 0) {
        return {
          technique: 'runAssignments',
          tier: 3,
          run: r,
          eliminated,
          explanation: `${this.runLabel(r, residual, cells.length)}: no valid fill of this run uses ${eliminated.map((e) => `${setText(e.mask)} at ${this.cellText(e.cell)}`).join(' or ')}`,
        };
      }
    }
    return null;
  }

  /**
   * Forcing chains (tiers 4–5): suppose a candidate, follow the forced consequences through the
   * binary links of the redundant-variable model, and eliminate it if they contradict. Short
   * chains are expert work; long ones extreme. See `kakuro-chains.ts`.
   */
  private applyChain(maxLength: number, technique: 'shortChain' | 'longChain'): KakuroStep | null {
    const chain = findFirstChainElimination(this.chainContext(), maxLength);
    if (!chain) return null;
    const bit = 1 << (chain.digit - 1);
    this.restrict(chain.cell, ~bit);
    return {
      technique,
      tier: TECHNIQUE_TIER[technique],
      run: this.runOf(chain.cell, 0) !== -1 ? this.runOf(chain.cell, 0) : this.runOf(chain.cell, 1),
      eliminated: [{ cell: chain.cell, mask: bit }],
      explanation: chain.explanation,
    };
  }

  private chainContext(): ChainContext {
    return {
      size: this.size,
      runs: this.runs,
      masks: this.masks,
      placed: this.placed,
      cellRuns: this.cellRuns,
      // Only combinations every cell of the run could still take part in — the same filter
      // `feasibleCombos` applies, so a chain never reasons from a combination tier 2 would reject.
      openCombos: (r) => {
        const { cells, combos } = this.openCombos(r);
        let cellsUnion = 0;
        for (const cell of cells) cellsUnion |= this.masks[cell];
        return combos.filter((combo) => (combo & ~cellsUnion) === 0 && cells.every((cell) => (this.masks[cell] & combo) !== 0));
      },
      runLabel: (r) => {
        const { cells, residual } = this.remainingOf(r);
        return this.runLabel(r, residual, cells.length);
      },
      cellText: (cell) => this.cellText(cell),
    };
  }

  // ---- the loop ----

  private readonly techniques: { name: KakuroTechnique; apply: () => KakuroStep | null }[] = [
    { name: 'comboRestriction', apply: () => this.applyComboRestriction() },
    { name: 'nakedSingle', apply: () => this.applyNakedSingle() },
    { name: 'hiddenSingle', apply: () => this.applyHiddenSingle() },
    { name: 'feasibleCombos', apply: () => this.applyFeasibleCombos() },
    { name: 'nakedSubset', apply: () => this.applyNakedSubset() },
    { name: 'hiddenSubset', apply: () => this.applyHiddenSubset() },
    { name: 'sumBounds', apply: () => this.applySumBounds() },
    { name: 'runAssignments', apply: () => this.applyRunAssignments() },
    { name: 'shortChain', apply: () => this.applyChain(CHAIN_TIER4_MAX_LENGTH, 'shortChain') },
    { name: 'longChain', apply: () => this.applyChain(CHAIN_TIER5_MAX_LENGTH, 'longChain') },
  ];

  isSolved(): boolean {
    return this.whites.every((cell) => this.placed[cell] === 1);
  }

  /** The current candidate mask of a cell (a placed cell's is its digit). */
  candidatesOf(cell: number): number {
    return this.masks[cell];
  }

  /** A placement on `cell` by naked single, else by hidden single in either of its runs. */
  private placePreferred(cell: number, cap: KakuroTier, disabled: ReadonlySet<KakuroTechnique>): KakuroStep | null {
    if (!disabled.has('nakedSingle')) {
      const single = this.placeIfSingle(cell);
      if (single) {
        this.note(1);
        return single;
      }
    }
    if (cap >= 2 && !disabled.has('hiddenSingle')) {
      for (const slot of [0, 1] as const) {
        const r = this.runOf(cell, slot);
        if (r === -1) continue;
        const hidden = this.hiddenSingleIn(r, cell);
        if (hidden) {
          this.note(2);
          return hidden;
        }
      }
    }
    return null;
  }

  private countOpenSingles(): number {
    let open = 0;
    for (const cell of this.whites) if (!this.placed[cell] && popcount(this.masks[cell]) === 1) open++;
    return open;
  }

  /**
   * Apply the cheapest technique that makes progress, at or below `cap`. Returns the step, or
   * `null` when nothing at that cap applies (stuck) or the state is contradictory.
   *
   * `preferCell`: if that cell is empty and placeable right now — a naked single, or the hidden
   * single of one of its runs (at or below `cap`) — place IT, so a hint on the player's selected
   * cell is taken the moment it is deducible rather than whichever placement happens to come
   * first in cell order.
   */
  step(cap: KakuroTier = 5, disabled: ReadonlySet<KakuroTechnique> = new Set(), preferCell = -1): KakuroStep | null {
    if (this.contradiction || this.isSolved()) return null;
    if (preferCell !== -1 && !this.placed[preferCell]) {
      const preferred = this.placePreferred(preferCell, cap, disabled);
      if (preferred) return preferred;
    }
    for (const technique of this.techniques) {
      const tier = TECHNIQUE_TIER[technique.name];
      if (tier > cap) break; // the table is tier-ordered
      if (disabled.has(technique.name)) continue;
      const step = technique.apply();
      if (step) {
        this.note(tier);
        return step;
      }
    }
    return null;
  }

  /**
   * Run the deduction loop until solved or stuck, cheapest technique first (so ripple effects
   * are exhausted before anything harder), recording the hardest tier that unsticks it — the
   * grade. `maxTier` caps which techniques may run; `disable` skips named ones (necessity
   * testing); `recordSteps` keeps every deduction for explaining.
   */
  solve(options: { maxTier?: KakuroTier; disable?: readonly KakuroTechnique[]; recordSteps?: boolean } = {}): KakuroSolveResult {
    const cap = options.maxTier ?? 5;
    const disabled = new Set(options.disable ?? []);
    const recordSteps = options.recordSteps ?? false;
    const techniqueCounts: Partial<Record<KakuroTechnique, number>> = {};
    let passes = 0;
    let opennessTotal = 0;

    while (!this.contradiction && !this.isSolved()) {
      passes += 1;
      opennessTotal += this.countOpenSingles();
      const step = this.step(cap, disabled);
      if (!step) break;
      if (recordSteps) this.steps.push(step);
      techniqueCounts[step.technique] = (techniqueCounts[step.technique] ?? 0) + 1;
    }

    return {
      solved: !this.contradiction && this.isSolved(),
      contradiction: this.contradiction,
      hardestTier: this.hardestTier,
      techniqueCounts,
      passes,
      avgOpenSingles: passes > 0 ? opennessTotal / passes : 0,
      steps: this.steps,
    };
  }
}

/** The structural half of the metrics — pure geometry of the shape, no solving. */
function shapeMetrics(shape: KakuroShape): Pick<KakuroMetrics, 'whiteCells' | 'maxRunLength' | 'avgCellRunLength' | 'blackDensity' | 'runLengthHistogram' | 'uniqueComboRuns'> {
  const { gridSize, runs } = shape;
  const whites = new Set<number>();
  const lengthSum = new Map<number, number>();
  const histogram = new Array<number>(10).fill(0);
  let maxRunLength = 0;
  let uniqueComboRuns = 0;
  for (const run of runs) {
    histogram[run.cells.length]++;
    maxRunLength = Math.max(maxRunLength, run.cells.length);
    if (runComboMasks(run.cells.length, run.sum).length === 1) uniqueComboRuns++;
    for (const cell of run.cells) {
      whites.add(cell);
      lengthSum.set(cell, (lengthSum.get(cell) ?? 0) + run.cells.length);
    }
  }
  let acrl = 0;
  for (const total of lengthSum.values()) acrl += total / 2;
  return {
    whiteCells: whites.size,
    maxRunLength,
    avgCellRunLength: whites.size > 0 ? acrl / whites.size : 0,
    blackDensity: 1 - whites.size / (gridSize * gridSize),
    runLengthHistogram: histogram,
    uniqueComboRuns,
  };
}

/** Everything the plan's instrumentation set asks for, measured on the empty puzzle. */
export function measureKakuro(shape: KakuroShape): KakuroMetrics {
  const structural = shapeMetrics(shape);
  const countPlaced = (solver: KakuroLogicalSolver) => {
    let placed = 0;
    let candidates = 0;
    for (let cell = 0; cell < shape.gridSize * shape.gridSize; cell++) {
      const mask = solver.candidatesOf(cell);
      if (mask === 0) continue;
      candidates += popcount(mask);
      if (popcount(mask) === 1) placed++;
    }
    return { placed, candidates };
  };
  const tier1 = new KakuroLogicalSolver(shape);
  tier1.solve({ maxTier: 1 });
  const tier2 = new KakuroLogicalSolver(shape);
  tier2.solve({ maxTier: 2 });
  const fixed = countPlaced(tier1).placed;
  const shaved = countPlaced(tier2);
  return {
    ...structural,
    fixed,
    implied: shaved.placed,
    rating: structural.whiteCells > 0 ? shaved.candidates / structural.whiteCells : 1,
  };
}

export interface KakuroClassification {
  /** The grade, or `null` when the ladder built so far cannot finish the puzzle. */
  tier: KakuroTier | null;
  difficulty: KakuroDifficulty;
  result: KakuroSolveResult;
  /** Present only when asked for (`metrics: true`) — two extra full solves. */
  metrics?: KakuroMetrics;
}

/**
 * Grade a puzzle: the hardest tier the logical solver needs to finish it, mapped to a published
 * difficulty. Unsolvable by the ladder built so far → `tier: null`, `difficulty: 'unrated'` —
 * never a guess (D8: the label comes from the classifier, post-generation, or not at all).
 *
 * `metrics: true` also runs `measureKakuro` (two more solves). Off by default so a generator
 * grading hundreds of candidates pays for one solve each; the dev badge asks for them.
 */
export function classifyKakuro(shape: KakuroShape, options: { metrics?: boolean } = {}): KakuroClassification {
  const result = new KakuroLogicalSolver(shape).solve({ recordSteps: true });
  const metrics = options.metrics ? measureKakuro(shape) : undefined;
  if (!result.solved) return { tier: null, difficulty: 'unrated', result, metrics };
  const tier = result.hardestTier === 0 ? 1 : result.hardestTier;
  return { tier, difficulty: TIER_DIFFICULTY[tier as Exclude<KakuroTier, 0>], result, metrics };
}

export interface KakuroHint {
  cell: number;
  digit: number;
  technique: KakuroTechnique;
  tier: KakuroTier;
  /** The placement's own reason, e.g. "Only 9 fits at row 2, column 4 (across 16-in-two; down 17-in-two)". */
  explanation: string;
  /** The eliminations made on the way to it, oldest first — the chain of "why". */
  leadUp: string[];
}

/**
 * The next placement a human could make from this grid, with its reason. Runs the ladder from
 * the grid as it stands until a technique places a digit; the steps it took to get there are
 * returned as the lead-up. `null` when the grid is contradictory (a wrong entry) or when
 * nothing at or below `cap` places anything.
 *
 * With `preferCell` (the player's selected cell), eliminations run ahead of placements: every
 * elimination technique at or below `cap` is exhausted before any OTHER cell is placed, and the
 * preferred cell is placed the moment it becomes deducible. So the hint lands on the selection
 * whenever the selection follows from the board as it stands, by eliminations alone — which are
 * all true of the player's board. If some other cell genuinely has to be placed first, that
 * placement is returned instead and the preference is ignored. `maxDetour` (default 0) lets a
 * caller that will ALSO apply the intervening placements allow the ladder past up to that many
 * placements elsewhere — the board store must not: a hint that fills one cell but explains it
 * with "down 3-in-one" assumes placements the player's board does not have (a review finding).
 */
export function explainKakuroHint(
  shape: KakuroShape,
  grid: readonly number[][],
  options: { cap?: KakuroTier; preferCell?: number; maxDetour?: number } = {}
): KakuroHint | null {
  const { cap = 5, preferCell = -1, maxDetour = 0 } = options;
  const solver = new KakuroLogicalSolver(shape, grid);
  const leadUp: string[] = [];
  const placers = new Set<KakuroTechnique>(['nakedSingle', 'hiddenSingle']);
  let first: KakuroHint | null = null;
  let detours = 0;
  for (let guard = 0; guard < 500; guard++) {
    // Preferred-cell mode: eliminations first (any tier ≤ cap), placements only when stuck.
    const step =
      preferCell === -1
        ? solver.step(cap)
        : (solver.step(cap, placers, preferCell) ?? solver.step(cap, undefined, preferCell));
    if (!step) break;
    if (step.placed) {
      const hint: KakuroHint = { ...step.placed, technique: step.technique, tier: step.tier, explanation: step.explanation, leadUp: [...leadUp] };
      if (preferCell === -1 || step.placed.cell === preferCell) return hint;
      first ??= hint;
      if (++detours > maxDetour) break;
    }
    leadUp.push(step.explanation);
  }
  return first;
}
