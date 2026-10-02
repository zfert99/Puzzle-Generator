/**
 * The Skyscrapers LOGICAL solver (plan slice E2) — solves the way a human does, applying named
 * techniques in tiers and recording the hardest one required. That "hardest tier" is the
 * puzzle's grade (Simonis, via Kakuro G9: the weakest technique level that finishes
 * search-free), the per-step record is what the Hint button explains, and the metrics are what
 * the generator calibrates against (E5). Distinct from the exact solver (`skyscrapers-solver.ts`),
 * which counts solutions for the uniqueness gate; this one never guesses — the top tier is a
 * bivalue contradiction test (Tatham's forcing chains), and bifurcation is not a tier.
 *
 * A class, with no inheritance (AGENTS.md §1): the candidate state is genuinely stateful and
 * every technique reads and writes it. Each tier runs its visibility techniques before its
 * Latin ones (Tatham's loop, the human guides), and the loop restarts from the easiest tier
 * after any progress, so "the first technique that fires" is the weakest that works.
 *
 * See `skyscrapers-logical-solver.md` for the "why" of each technique and the tier boundaries.
 */

import { maskToDigits, popcount } from '../grid-utils';
import type { SkyscrapersShape } from './skyscrapers-solver';
import {
  GUTTER_SIDES,
  clueAt,
  clueStatus,
  lineCells,
  presentClueCount,
  type GutterSide,
  type SkyscrapersDifficulty,
} from './skyscrapers-types';
import { bucketIndex, permutationTable } from './skyscrapers-visibility';

/** 0 = already solved; 1–5 = the technique ladder (research §2, decision D6). */
export type SkyscrapersTier = 0 | 1 | 2 | 3 | 4 | 5;

/** Every technique the deduction loop can apply, in priority order. */
export type SkyscrapersTechnique =
  | 'clueN'
  | 'clue1'
  | 'facingSum'
  | 'positionBound'
  | 'nearlyFilledClue'
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'clue2Pattern'
  | 'reachability'
  | 'lineScan'
  | 'lineEnumeration'
  | 'lineFilter'
  | 'nakedSubset'
  | 'hiddenSubset'
  | 'xWing'
  | 'forcingChain';

/** The tier each technique belongs to — the research's rungs 0–9 folded into five tiers (D6). */
export const TECHNIQUE_TIER: Record<SkyscrapersTechnique, SkyscrapersTier> = {
  clueN: 1,
  clue1: 1,
  facingSum: 1,
  positionBound: 1,
  nearlyFilledClue: 1,
  nakedSingle: 1,
  hiddenSingle: 1,
  clue2Pattern: 2,
  reachability: 2,
  lineScan: 1,
  lineEnumeration: 2,
  lineFilter: 3,
  nakedSubset: 3,
  hiddenSubset: 3,
  xWing: 4,
  forcingChain: 5,
};

/**
 * Up to this many surviving arrangements, the per-line scan is the beginner's clue-reading
 * ("only two arrangements of this row fit its clues") — `lineScan`, tier 1. E3 findings §3c.
 */
export const LINE_SCAN_MAX = 3;

/**
 * Up to this many surviving arrangements, the scan is a real one-line enumeration —
 * `lineEnumeration`, tier 2; beyond it the catch-all `lineFilter`, tier 3. E5 may refit both cuts.
 */
export const LINE_ENUMERATION_MAX = 12;

/**
 * The per-line arrangement scan is one mechanism graded by **how many arrangements it had to
 * consider** (E3 findings §3c): a flat tier for it made 91% of all-clue 6×6 squares "hard" and
 * left easy and medium ungenerable. The bands are ordered; each one's lower bound is the
 * previous one's upper bound plus one, so a survivor count always falls in exactly one band.
 */
export const LINE_BANDS: readonly { technique: 'lineScan' | 'lineEnumeration' | 'lineFilter'; maxSurvivors: number }[] = [
  { technique: 'lineScan', maxSurvivors: LINE_SCAN_MAX },
  { technique: 'lineEnumeration', maxSurvivors: LINE_ENUMERATION_MAX },
  { technique: 'lineFilter', maxSurvivors: Infinity },
];

/** The tier → published difficulty map. Provisional until E5 calibrates it against measurements. */
export const TIER_DIFFICULTY: Record<Exclude<SkyscrapersTier, 0>, Exclude<SkyscrapersDifficulty, 'unrated'>> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
  4: 'expert',
  5: 'extreme',
};

/** One deduction, as a human would describe it. */
export interface SkyscrapersStep {
  technique: SkyscrapersTechnique;
  tier: SkyscrapersTier;
  /** A height placed by this step, if it placed one (flat cell index). */
  placed?: { cell: number; digit: number };
  /** Candidate masks removed, per cell (bit `h − 1` = height `h`). */
  eliminated: { cell: number; mask: number }[];
  /** Plain-English reason, e.g. "Clue 1 on row 3 from the left: the tallest tower is next to it". */
  explanation: string;
}

/** What proves a tier — the structural levers the research names, plus what the ladder found. */
export interface SkyscrapersMetrics {
  size: number;
  presentClues: number;
  blankClues: number;
  /** Clues equal to 1 or N — each resolves a cell or a line in one move. */
  trivialClues: number;
  /** Facing pairs summing to N + 1 — each pins the tallest tower. */
  facingSumPairs: number;
  /** Cells placed by tier 1 alone. */
  fixed: number;
  /** Cells placed by tiers 1–2. */
  implied: number;
  /** Mean candidates per empty cell after the tier-1–2 pass; 1.0 = finished by tiers 1–2. */
  rating: number;
}

/** Outcome of a logical solve — the grade plus the raw material for scoring and explaining. */
export interface SkyscrapersSolveResult {
  solved: boolean;
  /** The grid as it stands contradicts itself (only possible from a player's grid). */
  contradiction: boolean;
  hardestTier: SkyscrapersTier;
  /** How many times each technique fired (absent = never). */
  techniqueCounts: Partial<Record<SkyscrapersTechnique, number>>;
  /** Deduction-loop iterations until solved/stuck. */
  passes: number;
  /** Mean number of cells placeable as a single per pass — the opportunity density the scorer reads. */
  avgOpenSingles: number;
  /** The steps, in order, when `recordSteps` was asked for. */
  steps: SkyscrapersStep[];
}

/** A row or column as the Latin techniques see it: its cells, and how a hint names it. */
interface House {
  cells: number[];
  label: string;
}

/** One clued line's arrangement scan against the current candidates (see `lineScans`). */
interface LineScan {
  /** Arrangements of the line still consistent with the candidates (1 for a finished line). */
  survivors: number;
  /** Per position, the candidate bits no surviving arrangement uses — what the scan would remove. */
  removable: Int32Array;
  /** Whether any `removable` bit is set. */
  productive: boolean;
}

/** A row or column with both of its clues — the line scan's view. */
interface FilterLine extends House {
  left: number;
  right: number;
}

/**
 * The human-style solver: a candidate grid plus the technique ladder, applied one deduction at a
 * time (`step`) or to the end (`solve`). Build one per puzzle (and per player grid for a hint);
 * it is stateful and single-use. `classifySkyscrapers`, `measureSkyscrapers` and
 * `explainSkyscrapersHint` below are the three ways the rest of the app reads it.
 */
export class SkyscrapersLogicalSolver {
  private readonly size: number;
  private readonly shape: SkyscrapersShape;
  private readonly grid: number[][];
  /** Candidate masks per flat cell: bit h−1 ↔ height h. */
  private readonly cands: Int32Array;
  private hardestTier: SkyscrapersTier = 0;
  private contradiction = false;
  private readonly steps: SkyscrapersStep[] = [];
  /** Every clued line: side, index, clue, and its cells from the clue inward. */
  private readonly cluedLines: { side: GutterSide; index: number; clue: number; cells: number[] }[] = [];
  /** Every **clued** row (read from the left) and column (from the top) — the line scan's view. Unclued lines belong to the Latin rules alone. */
  private readonly filterLines: FilterLine[] = [];
  /** Every row and column — the Latin techniques' view. Built once; the solve loop allocates nothing here. */
  private readonly houses: House[] = [];
  /** The two `filterLines` indices a cell belongs to (−1 = that line is unclued), so a candidate change dirties only its own lines. */
  private readonly cellFilterLines: Int32Array;
  /** One scan per filter line, recomputed only while its `dirty` flag is set. */
  private readonly scans: LineScan[] = [];
  private readonly dirty: Uint8Array;

  constructor(shape: SkyscrapersShape, grid?: readonly number[][]) {
    this.shape = shape;
    this.size = shape.gridSize;
    const size = this.size;
    const { clues } = shape;
    const all = (1 << size) - 1;
    this.grid = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => grid?.[r]?.[c] ?? 0));
    this.cands = new Int32Array(size * size).fill(all);
    this.cellFilterLines = new Int32Array(size * size * 2).fill(-1);
    for (const side of GUTTER_SIDES) {
      for (let i = 0; i < size; i++) {
        const clue = clueAt(clues, side, i);
        if (clue > 0) this.cluedLines.push({ side, index: i, clue, cells: lineCells(size, side, i) });
      }
    }
    for (let i = 0; i < size; i++) {
      const row = { cells: lineCells(size, 'left', i), label: `row ${i + 1}` };
      const column = { cells: lineCells(size, 'top', i), label: `column ${i + 1}` };
      this.houses.push(row, column);
      const rowClues = { left: clueAt(clues, 'left', i), right: clueAt(clues, 'right', i) };
      const columnClues = { left: clueAt(clues, 'top', i), right: clueAt(clues, 'bottom', i) };
      if (rowClues.left !== 0 || rowClues.right !== 0) {
        for (const cell of row.cells) this.cellFilterLines[cell * 2] = this.filterLines.length;
        this.filterLines.push({ ...row, ...rowClues });
      }
      if (columnClues.left !== 0 || columnClues.right !== 0) {
        for (const cell of column.cells) this.cellFilterLines[cell * 2 + 1] = this.filterLines.length;
        this.filterLines.push({ ...column, ...columnClues });
      }
    }
    this.dirty = new Uint8Array(this.filterLines.length).fill(1);
    for (let k = 0; k < this.filterLines.length; k++) this.scans.push({ survivors: 1, removable: new Int32Array(size), productive: false });
    // A placed height is a singleton, and leaves its row and column (the Latin rule). A height
    // that repeats in a row or column is a contradiction from the start (a player's grid can hold
    // one) — `stripFromPeers` only touches empty cells, so the repeat is checked explicitly.
    const rowSeen = new Int32Array(size);
    const colSeen = new Int32Array(size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const h = this.grid[r][c];
        if (h === 0) continue;
        const bit = 1 << (h - 1);
        if (h > size || rowSeen[r] & bit || colSeen[c] & bit) this.contradiction = true;
        rowSeen[r] |= bit;
        colSeen[c] |= bit;
        this.setCandidates(r * size + c, bit);
        this.stripFromPeers(r * size + c, bit);
      }
    }
    // A filled prefix that already breaks its clue is a contradiction from the start — judged by
    // the board's own prefix rule (`clueStatus`, G10), so the solver and the red clue agree.
    for (const line of this.cluedLines) {
      const heights = line.cells.map((cell) => this.grid[Math.floor(cell / size)][cell % size]);
      if (clueStatus(heights, line.clue) === 'violated') this.contradiction = true;
    }
  }

  // ---- state helpers ----

  private rc(cell: number): [number, number] {
    return [Math.floor(cell / this.size), cell % this.size];
  }

  private cellText(cell: number): string {
    const [r, c] = this.rc(cell);
    return `row ${r + 1}, column ${c + 1}`;
  }

  private lineText(line: { side: GutterSide; index: number; clue: number }): string {
    const axis = line.side === 'left' || line.side === 'right' ? 'row' : 'column';
    return `clue ${line.clue} on ${axis} ${line.index + 1} from the ${line.side}`;
  }

  private note(tier: SkyscrapersTier): void {
    if (tier > this.hardestTier) this.hardestTier = tier;
  }

  private isSolved(): boolean {
    return this.grid.every((row) => row.every((h) => h > 0));
  }

  private valueOf(cell: number): number {
    const [r, c] = this.rc(cell);
    return this.grid[r][c];
  }

  /** Remove `mask` from every empty peer (row + column) of `cell`. */
  private stripFromPeers(cell: number, mask: number): void {
    const [r, c] = this.rc(cell);
    for (let i = 0; i < this.size; i++) {
      const rowPeer = r * this.size + i;
      const colPeer = i * this.size + c;
      if (rowPeer !== cell && this.grid[r][i] === 0) this.restrict(rowPeer, ~mask);
      if (colPeer !== cell && this.grid[i][c] === 0) this.restrict(colPeer, ~mask);
    }
  }

  /**
   * The one write path for a cell's candidates: every change dirties the cell's two clued lines
   * so their scans are recomputed on the next read, and nothing else. No other code assigns
   * `cands`, which is what makes the scan cache sound by construction rather than by convention.
   */
  private setCandidates(cell: number, mask: number): void {
    this.cands[cell] = mask;
    const rowLine = this.cellFilterLines[cell * 2];
    const columnLine = this.cellFilterLines[cell * 2 + 1];
    if (rowLine !== -1) this.dirty[rowLine] = 1;
    if (columnLine !== -1) this.dirty[columnLine] = 1;
  }

  /** Start from another solver's candidates (the forcing-chain trial): every line is rescanned. */
  private adoptCandidates(cands: Int32Array): void {
    for (let cell = 0; cell < cands.length; cell++) this.setCandidates(cell, cands[cell]);
  }

  /** AND `mask` into a cell's candidates; returns the bits removed (0 = nothing). */
  private restrict(cell: number, mask: number): number {
    const before = this.cands[cell];
    const after = before & mask;
    if (after === before) return 0;
    this.setCandidates(cell, after);
    if (after === 0) this.contradiction = true;
    return before & ~after;
  }

  private place(cell: number, digit: number): void {
    const [r, c] = this.rc(cell);
    if ((this.cands[cell] & (1 << (digit - 1))) === 0) this.contradiction = true;
    this.grid[r][c] = digit;
    this.setCandidates(cell, 1 << (digit - 1));
    this.stripFromPeers(cell, 1 << (digit - 1));
  }

  private placeStep(technique: SkyscrapersTechnique, cell: number, digit: number, explanation: string): SkyscrapersStep {
    this.place(cell, digit);
    this.note(TECHNIQUE_TIER[technique]);
    return { technique, tier: TECHNIQUE_TIER[technique], placed: { cell, digit }, eliminated: [], explanation };
  }

  private eliminateStep(
    technique: SkyscrapersTechnique,
    eliminated: { cell: number; mask: number }[],
    explanation: string
  ): SkyscrapersStep | null {
    if (eliminated.length === 0) return null;
    this.note(TECHNIQUE_TIER[technique]);
    return { technique, tier: TECHNIQUE_TIER[technique], eliminated, explanation };
  }

  /** Heights still open in the line's cells beyond the filled prefix, as the prefix sees them. */
  private prefix(line: { cells: number[] }): { filled: number; tallest: number; seen: number } {
    let filled = 0;
    let tallest = 0;
    let seen = 0;
    for (const cell of line.cells) {
      const h = this.valueOf(cell);
      if (h === 0) break;
      filled += 1;
      if (h > tallest) {
        tallest = h;
        seen += 1;
      }
    }
    return { filled, tallest, seen };
  }

  // ---- tier 1: the one-move clues and the Latin singles ----

  /**
   * Clue N: the heights climb 1, 2, …, N from that edge — place the first unplaced one, or, when a
   * `target` cell is asked for, that cell (every position's height is known at once).
   */
  private applyClueN(target: number): SkyscrapersStep | null {
    const N = this.size;
    for (const line of this.cluedLines) {
      if (line.clue !== N) continue;
      for (let d = 0; d < N; d++) {
        const cell = line.cells[d];
        if (this.valueOf(cell) === 0 && (target === -1 || cell === target)) {
          return this.placeStep('clueN', cell, d + 1, `${this.lineText(line)}: every tower is visible, so the heights climb 1 to ${N} — ${d + 1} goes at ${this.cellText(cell)}`);
        }
      }
    }
    return null;
  }

  /** Clue 1: only the tallest tower is visible, so it stands next to the clue. */
  private applyClue1(target: number): SkyscrapersStep | null {
    const N = this.size;
    for (const line of this.cluedLines) {
      if (line.clue !== 1) continue;
      const cell = line.cells[0];
      if (this.valueOf(cell) === 0 && (target === -1 || cell === target)) {
        return this.placeStep('clue1', cell, N, `${this.lineText(line)}: only one tower is visible, so the tallest (${N}) stands next to the clue at ${this.cellText(cell)}`);
      }
    }
    return null;
  }

  /** Facing clues a + b = N + 1: the tallest tower is at distance a − 1 from the a side. */
  private applyFacingSum(target: number): SkyscrapersStep | null {
    const N = this.size;
    const { clues } = this.shape;
    const pairs: [GutterSide, GutterSide][] = [['left', 'right'], ['top', 'bottom']];
    for (const [near, far] of pairs) {
      for (let i = 0; i < N; i++) {
        const a = clueAt(clues, near, i);
        const b = clueAt(clues, far, i);
        if (a === 0 || b === 0 || a + b !== N + 1) continue;
        const cell = lineCells(N, near, i)[a - 1];
        if (this.valueOf(cell) === 0 && (target === -1 || cell === target)) {
          const axis = near === 'left' ? 'row' : 'column';
          return this.placeStep('facingSum', cell, N, `${axis} ${i + 1}: the clues ${a} and ${b} add up to ${N + 1}, so the tallest tower (${N}) is ${a} in from the ${near} — ${this.cellText(cell)}`);
        }
      }
    }
    return null;
  }

  /** Position bound: at distance d from clue c, a height above N − c + 1 + d would hide too much. */
  private applyPositionBound(): SkyscrapersStep | null {
    const N = this.size;
    for (const line of this.cluedLines) {
      const c = line.clue;
      const eliminated: { cell: number; mask: number }[] = [];
      for (let d = 0; d < N; d++) {
        const cell = line.cells[d];
        if (this.valueOf(cell) !== 0) continue;
        const maxHeight = N - c + 1 + d;
        if (maxHeight >= N) continue;
        const allowed = (1 << maxHeight) - 1;
        const removed = this.restrict(cell, allowed);
        if (removed) eliminated.push({ cell, mask: removed });
      }
      const step = this.eliminateStep('positionBound', eliminated, `${this.lineText(line)}: to show ${c} towers, a tower at distance d from the clue can be at most ${N - c + 1} + d`);
      if (step) return step;
    }
    return null;
  }

  /**
   * Nearly-filled clue: when c − 1 towers are already visible from a clue of c and the tallest
   * (N) is not among them, the only tower that may still be seen is N itself — any other tower
   * taller than the tallest so far would be seen too, and N after it, one too many. So the next
   * cell cannot hold a height strictly between the tallest seen and N. (The reachability rule
   * subsumes this; it is kept as a named rung because every guide teaches it as its own move.)
   */
  private applyNearlyFilledClue(): SkyscrapersStep | null {
    const N = this.size;
    for (const line of this.cluedLines) {
      const { filled, tallest, seen } = this.prefix(line);
      if (filled === N || seen !== line.clue - 1 || tallest === N) continue;
      const cell = line.cells[filled];
      let forbidden = 0;
      for (let h = tallest + 1; h < N; h++) forbidden |= 1 << (h - 1);
      if (forbidden === 0) continue;
      const removed = this.restrict(cell, ~forbidden);
      if (removed) {
        return this.eliminateStep('nearlyFilledClue', [{ cell, mask: removed }], `${this.lineText(line)}: ${seen} of ${line.clue} towers are visible and the tallest is still to come, so only ${N} can be the next one seen — ${maskToDigits(removed).join(', ')} cannot stand at ${this.cellText(cell)}`);
      }
    }
    return null;
  }

  private applyNakedSingle(): SkyscrapersStep | null {
    const N = this.size;
    for (let cell = 0; cell < N * N; cell++) {
      if (this.valueOf(cell) !== 0) continue;
      const mask = this.cands[cell];
      if (popcount(mask) === 1) {
        const digit = 32 - Math.clz32(mask);
        return this.placeStep('nakedSingle', cell, digit, `Only ${digit} fits at ${this.cellText(cell)}`);
      }
    }
    return null;
  }

  private applyHiddenSingle(): SkyscrapersStep | null {
    const N = this.size;
    for (let h = 1; h <= N; h++) {
      const bit = 1 << (h - 1);
      for (let r = 0; r < N; r++) {
        if (this.grid[r].includes(h)) continue;
        const spots: number[] = [];
        for (let c = 0; c < N; c++) if (this.grid[r][c] === 0 && this.cands[r * N + c] & bit) spots.push(r * N + c);
        if (spots.length === 1) return this.placeStep('hiddenSingle', spots[0], h, `${h} has only one place left in row ${r + 1}: ${this.cellText(spots[0])}`);
        if (spots.length === 0) this.contradiction = true;
      }
      for (let c = 0; c < N; c++) {
        if (this.grid.some((row) => row[c] === h)) continue;
        const spots: number[] = [];
        for (let r = 0; r < N; r++) if (this.grid[r][c] === 0 && this.cands[r * N + c] & bit) spots.push(r * N + c);
        if (spots.length === 1) return this.placeStep('hiddenSingle', spots[0], h, `${h} has only one place left in column ${c + 1}: ${this.cellText(spots[0])}`);
        if (spots.length === 0) this.contradiction = true;
      }
    }
    return null;
  }

  // ---- tier 2: the clue-2 patterns and visible-count reachability ----

  /**
   * Clue 2 (Conceptis's basic rules, named for friendlier hints): (a) N − 1 cannot stand second
   * from the clue — it would be seen along with the first tower and then N; (b) a 1 next to the
   * clue puts N right behind it; (c) with N placed d cells in (d ≥ 2), the first tower must
   * out-top every tower between, so it is at least d.
   */
  private applyClue2Pattern(target: number): SkyscrapersStep | null {
    const N = this.size;
    for (const line of this.cluedLines) {
      if (line.clue !== 2) continue;
      const first = line.cells[0];
      const second = line.cells[1];
      const firstValue = this.valueOf(first);
      if (firstValue === 1 && this.valueOf(second) === 0 && (target === -1 || second === target)) {
        return this.placeStep('clue2Pattern', second, N, `${this.lineText(line)}: a 1 next to the clue means the tallest (${N}) must be right behind it — ${this.cellText(second)}`);
      }
      if (this.valueOf(second) === 0) {
        const removed = this.restrict(second, ~(1 << (N - 2)));
        if (removed) return this.eliminateStep('clue2Pattern', [{ cell: second, mask: removed }], `${this.lineText(line)}: ${N - 1} cannot stand second from the clue — it would be seen along with the first tower and then ${N}`);
      }
      const dOfN = line.cells.findIndex((cell) => this.valueOf(cell) === N);
      if (dOfN >= 2 && firstValue === 0) {
        const allowed = ((1 << N) - 1) & ~((1 << (dOfN - 1)) - 1); // heights ≥ dOfN
        const removed = this.restrict(first, allowed);
        if (removed) return this.eliminateStep('clue2Pattern', [{ cell: first, mask: removed }], `${this.lineText(line)}: the tallest is ${dOfN} cells in, so the first tower must out-top the ${dOfN - 1} between — at least ${dOfN}`);
      }
    }
    return null;
  }

  /**
   * Reachability: at the first empty cell of a clue's prefix, a height is impossible if, after
   * it, the clue could no longer be met — too many already visible, or too few cells (and too
   * few taller heights) left to make up the shortfall. The tallest tower N is always seen, so
   * "seen" can still grow only by heights above the current tallest.
   */
  private applyReachability(): SkyscrapersStep | null {
    const N = this.size;
    for (const line of this.cluedLines) {
      const { filled, tallest, seen } = this.prefix(line);
      if (filled === N) continue;
      const cell = line.cells[filled];
      const remainingAfter = N - filled - 1;
      const eliminated: { cell: number; mask: number }[] = [];
      let removedMask = 0;
      for (let h = 1; h <= N; h++) {
        const bit = 1 << (h - 1);
        if ((this.cands[cell] & bit) === 0) continue;
        const visibleNow = seen + (h > tallest ? 1 : 0);
        const top = Math.max(tallest, h);
        const canStillSee = Math.min(remainingAfter, N - top); // only heights above `top` can be seen later
        const mustStillSee = top === N ? 0 : 1; // N is always seen, and it is still to come
        if (visibleNow > line.clue || visibleNow + canStillSee < line.clue || visibleNow + mustStillSee > line.clue) {
          removedMask |= bit;
        }
      }
      if (removedMask) {
        const removed = this.restrict(cell, ~removedMask);
        if (removed) eliminated.push({ cell, mask: removed });
      }
      const step = this.eliminateStep('reachability', eliminated, `${this.lineText(line)}: ${seen} tower${seen === 1 ? '' : 's'} visible so far — at ${this.cellText(cell)}, ${maskToDigits(removedMask).join(', ')} would make exactly ${line.clue} impossible`);
      if (step) return step;
    }
    return null;
  }

  // ---- tier 3: the per-line what-if, and the Latin subsets ----

  /**
   * The per-line arrangement scan behind `lineScan` / `lineEnumeration` / `lineFilter`: for
   * every clued line, the arrangements still consistent with the candidates, how many there
   * are, and the candidate bits none of them uses. Only lines marked dirty by a candidate change
   * are rescanned — a restrict touches one row and one column, so the other 2N − 2 scans stand —
   * and the three bands read the same result because the ladder asks for the weakest band first.
   * A finished line reports one arrangement and nothing to remove without a scan.
   */
  private lineScans(): LineScan[] {
    const N = this.size;
    const table = permutationTable(N);
    for (let index = 0; index < this.filterLines.length; index++) {
      if (!this.dirty[index]) continue;
      this.dirty[index] = 0;
      const line = this.filterLines[index];
      const scan = this.scans[index];
      scan.removable.fill(0);
      if (line.cells.every((cell) => this.valueOf(cell) !== 0)) {
        scan.survivors = 1;
        scan.productive = false;
        continue;
      }
      const bucket = table.buckets[bucketIndex(N, line.left, line.right)];
      const positions = scan.removable; // the OR of surviving heights per position, complemented below
      let survivors = 0;
      for (let k = 0; k < bucket.length; k++) {
        const base = bucket[k] * N;
        let ok = true;
        for (let i = 0; i < N; i++) {
          if ((this.cands[line.cells[i]] & (1 << (table.heights[base + i] - 1))) === 0) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        survivors += 1;
        for (let i = 0; i < N; i++) positions[i] |= 1 << (table.heights[base + i] - 1);
      }
      let productive = false;
      for (let i = 0; i < N; i++) {
        const cell = line.cells[i];
        const removable = this.valueOf(cell) === 0 ? this.cands[cell] & ~positions[i] : 0;
        scan.removable[i] = removable;
        if (removable !== 0) productive = true;
      }
      scan.survivors = survivors;
      scan.productive = productive;
    }
    return this.scans;
  }

  /**
   * Line filtering, one band of scan sizes at a time: every arrangement of a line that matches
   * its clues is enumerated; a height no arrangement puts in a cell is impossible there (the
   * research's catch-all, Tatham's `solver_hard`). The band — `lineScan` up to
   * `LINE_SCAN_MAX` arrangements, `lineEnumeration` up to `LINE_ENUMERATION_MAX`, `lineFilter`
   * beyond — is what a player had to look through, so it is what the step is graded by (E3
   * findings §3c). Stops after the **first productive line** in the band so diagnostics do not
   * inflate the puzzle's difficulty (Tatham's rule). A line with no surviving arrangement is a
   * contradiction whatever the band.
   */
  private applyLineBand(band: number): SkyscrapersStep | null {
    const N = this.size;
    const { technique, maxSurvivors } = LINE_BANDS[band];
    const minSurvivors = band === 0 ? 1 : LINE_BANDS[band - 1].maxSurvivors + 1;
    const scans = this.lineScans();
    for (let index = 0; index < scans.length; index++) {
      const scan = scans[index];
      if (scan.survivors === 0) {
        this.contradiction = true;
        return null;
      }
      if (!scan.productive || scan.survivors < minSurvivors || scan.survivors > maxSurvivors) continue;
      const line = this.filterLines[index];
      const eliminated: { cell: number; mask: number }[] = [];
      for (let i = 0; i < N; i++) {
        const removable = scan.removable[i];
        if (removable === 0) continue;
        const cell = line.cells[i];
        const removed = this.restrict(cell, ~removable);
        if (removed) eliminated.push({ cell, mask: removed });
      }
      const both = line.left !== 0 && line.right !== 0;
      const clueText = [line.left ? `${line.left}` : null, line.right ? `${line.right}` : null].filter(Boolean).join(' and ');
      const fit = scan.survivors === 1 ? 'only one arrangement fits the clue' : `only ${scan.survivors} arrangements fit the clue`;
      const deny = scan.survivors === 1 ? 'it does not allow' : 'none of them allows';
      return this.eliminateStep(technique, eliminated, `${line.label} (clue${both ? 's' : ''} ${clueText}): ${fit}${both ? 's' : ''}, and ${deny} ${eliminated.map((e) => `${maskToDigits(e.mask).join('/')} at ${this.cellText(e.cell)}`).join(', ')}`);
    }
    return null;
  }

  /** Naked pairs and triples within a row or column: k cells sharing k candidates own them. */
  private applyNakedSubset(): SkyscrapersStep | null {
    for (const k of [2, 3]) {
      for (const house of this.houses) {
        const empties = house.cells.filter((cell) => this.valueOf(cell) === 0 && popcount(this.cands[cell]) <= k);
        const found = this.findNakedSubset(house, empties, k);
        if (found) return found;
      }
    }
    return null;
  }

  private findNakedSubset(house: House, empties: number[], k: number): SkyscrapersStep | null {
    const pick = (start: number, chosen: number[], union: number): SkyscrapersStep | null => {
      if (chosen.length === k) {
        if (popcount(union) !== k) return null;
        const eliminated: { cell: number; mask: number }[] = [];
        for (const cell of house.cells) {
          if (chosen.includes(cell) || this.valueOf(cell) !== 0) continue;
          const removed = this.restrict(cell, ~union);
          if (removed) eliminated.push({ cell, mask: removed });
        }
        return this.eliminateStep('nakedSubset', eliminated, `${house.label}: ${chosen.map((c) => this.cellText(c)).join(' and ')} can only hold ${maskToDigits(union).join(', ')}, so no other cell there can`);
      }
      for (let i = start; i < empties.length; i++) {
        const step = pick(i + 1, [...chosen, empties[i]], union | this.cands[empties[i]]);
        if (step) return step;
      }
      return null;
    };
    return pick(0, [], 0);
  }

  /** Hidden pairs within a row or column: two heights confined to the same two cells own them. */
  private applyHiddenSubset(): SkyscrapersStep | null {
    const N = this.size;
    for (const house of this.houses) {
      const spots = new Map<number, number[]>();
      for (let h = 1; h <= N; h++) {
        if (house.cells.some((cell) => this.valueOf(cell) === h)) continue;
        const bit = 1 << (h - 1);
        spots.set(h, house.cells.filter((cell) => this.valueOf(cell) === 0 && this.cands[cell] & bit));
      }
      const heights = [...spots.keys()];
      for (let a = 0; a < heights.length; a++) {
        for (let b = a + 1; b < heights.length; b++) {
          const sa = spots.get(heights[a])!;
          const sb = spots.get(heights[b])!;
          if (sa.length !== 2 || sb.length !== 2 || sa[0] !== sb[0] || sa[1] !== sb[1]) continue;
          const keep = (1 << (heights[a] - 1)) | (1 << (heights[b] - 1));
          const eliminated: { cell: number; mask: number }[] = [];
          for (const cell of sa) {
            const removed = this.restrict(cell, keep);
            if (removed) eliminated.push({ cell, mask: removed });
          }
          const step = this.eliminateStep('hiddenSubset', eliminated, `${house.label}: ${heights[a]} and ${heights[b]} can only go in ${this.cellText(sa[0])} and ${this.cellText(sa[1])}, so those cells hold nothing else`);
          if (step) return step;
        }
      }
    }
    return null;
  }

  // ---- tier 4: a single-height fish across rows × columns ----

  private applyXWing(): SkyscrapersStep | null {
    const N = this.size;
    for (let orient = 0; orient < 2; orient++) {
      const rows = orient === 0;
      for (let h = 1; h <= N; h++) {
        const bit = 1 << (h - 1);
        const linePositions: number[][] = [];
        for (let a = 0; a < N; a++) {
          const positions: number[] = [];
          for (let b = 0; b < N; b++) {
            const r = rows ? a : b;
            const c = rows ? b : a;
            if (this.grid[r][c] === 0 && this.cands[r * N + c] & bit) positions.push(b);
          }
          linePositions.push(positions);
        }
        for (let a1 = 0; a1 < N; a1++) {
          if (linePositions[a1].length !== 2) continue;
          for (let a2 = a1 + 1; a2 < N; a2++) {
            if (linePositions[a2].length !== 2) continue;
            if (linePositions[a1][0] !== linePositions[a2][0] || linePositions[a1][1] !== linePositions[a2][1]) continue;
            const [b1, b2] = linePositions[a1];
            const eliminated: { cell: number; mask: number }[] = [];
            for (let a = 0; a < N; a++) {
              if (a === a1 || a === a2) continue;
              for (const b of [b1, b2]) {
                const r = rows ? a : b;
                const c = rows ? b : a;
                if (this.grid[r][c] !== 0) continue;
                const removed = this.restrict(r * N + c, ~bit);
                if (removed) eliminated.push({ cell: r * N + c, mask: removed });
              }
            }
            const axis = rows ? 'rows' : 'columns';
            const cross = rows ? 'columns' : 'rows';
            const step = this.eliminateStep('xWing', eliminated, `X-wing on ${h}: in ${axis} ${a1 + 1} and ${a2 + 1} it can only be in ${cross} ${b1 + 1} and ${b2 + 1}, so it is nowhere else in those ${cross}`);
            if (step) return step;
          }
        }
      }
    }
    return null;
  }

  // ---- tier 5: a bivalue contradiction test (Tatham's forcing chains) ----

  /**
   * For a cell with two or three candidates, suppose each in turn and propagate with tiers 1–4
   * (no recording); a supposition that contradicts itself is eliminated. Tatham's forcing-chain
   * tier ("latin_solver_forcing"), bounded by the trial's step count, and never a guess that is
   * kept: a value is removed only when it is proved impossible — the alternatives are not
   * assumed, which is what separates this from bifurcation (rung 10, never shipped — D6).
   * Cells with the fewest candidates first, so a bivalue test is tried before a trivalue one.
   */
  private applyForcingChain(): SkyscrapersStep | null {
    const N = this.size;
    const order: number[] = [];
    for (let cell = 0; cell < N * N; cell++) {
      const count = popcount(this.cands[cell]);
      if (this.valueOf(cell) === 0 && count >= 2 && count <= 3) order.push(cell);
    }
    order.sort((a, b) => popcount(this.cands[a]) - popcount(this.cands[b]));
    for (const cell of order) {
      for (const digit of maskToDigits(this.cands[cell])) {
        const trial = new SkyscrapersLogicalSolver(this.shape, this.grid);
        trial.adoptCandidates(this.cands);
        trial.place(cell, digit);
        let steps = 0;
        while (!trial.contradiction && !trial.isSolved() && steps < 200) {
          if (!trial.step(4)) break;
          steps += 1;
        }
        if (trial.contradiction) {
          const removed = this.restrict(cell, ~(1 << (digit - 1)));
          if (removed) {
            return this.eliminateStep('forcingChain', [{ cell, mask: removed }], `Supposing ${digit} at ${this.cellText(cell)} leads to a contradiction after ${steps} step${steps === 1 ? '' : 's'}, so it is not ${digit}`);
          }
        }
      }
    }
    return null;
  }

  // ---- the loop ----

  /**
   * The weakest technique that makes progress, visibility rules before Latin rules within a
   * tier, up to `cap`. `disabled` techniques are skipped. `target`, when set, confines **every
   * placing technique** to that one cell — eliminations still run anywhere — so the hint
   * explainer can place the cell the player selected the moment the board makes it deducible,
   * by whichever rule does it (a clue-N climb as much as a naked single).
   */
  step(cap: SkyscrapersTier = 5, disabled: ReadonlySet<SkyscrapersTechnique> = new Set(), target = -1): SkyscrapersStep | null {
    const ladder: [SkyscrapersTechnique, () => SkyscrapersStep | null][] = [
      ['clueN', () => this.applyClueN(target)],
      ['clue1', () => this.applyClue1(target)],
      ['facingSum', () => this.applyFacingSum(target)],
      ['positionBound', () => this.applyPositionBound()],
      ['nearlyFilledClue', () => this.applyNearlyFilledClue()],
      ['nakedSingle', () => (target === -1 ? this.applyNakedSingle() : this.placeIfSingle(target))],
      ['hiddenSingle', () => (target === -1 ? this.applyHiddenSingle() : this.hiddenSingleAt(target))],
      ['lineScan', () => this.applyLineBand(0)],
      ['clue2Pattern', () => this.applyClue2Pattern(target)],
      ['reachability', () => this.applyReachability()],
      ['lineEnumeration', () => this.applyLineBand(1)],
      ['lineFilter', () => this.applyLineBand(2)],
      ['nakedSubset', () => this.applyNakedSubset()],
      ['hiddenSubset', () => this.applyHiddenSubset()],
      ['xWing', () => this.applyXWing()],
      ['forcingChain', () => this.applyForcingChain()],
    ];
    for (const [technique, apply] of ladder) {
      if (TECHNIQUE_TIER[technique] > cap || disabled.has(technique)) continue;
      const step = apply();
      if (this.contradiction) return null;
      if (step) return step;
    }
    return null;
  }

  private placeIfSingle(cell: number): SkyscrapersStep | null {
    if (this.valueOf(cell) !== 0 || popcount(this.cands[cell]) !== 1) return null;
    const digit = 32 - Math.clz32(this.cands[cell]);
    return this.placeStep('nakedSingle', cell, digit, `Only ${digit} fits at ${this.cellText(cell)}`);
  }

  private hiddenSingleAt(cell: number): SkyscrapersStep | null {
    const N = this.size;
    if (this.valueOf(cell) !== 0) return null;
    const [r, c] = this.rc(cell);
    for (let h = 1; h <= N; h++) {
      const bit = 1 << (h - 1);
      if ((this.cands[cell] & bit) === 0) continue;
      const rowSpots = Array.from({ length: N }, (_, i) => r * N + i).filter((x) => this.valueOf(x) === 0 && this.cands[x] & bit);
      if (rowSpots.length === 1) return this.placeStep('hiddenSingle', cell, h, `${h} has only one place left in row ${r + 1}: ${this.cellText(cell)}`);
      const colSpots = Array.from({ length: N }, (_, i) => i * N + c).filter((x) => this.valueOf(x) === 0 && this.cands[x] & bit);
      if (colSpots.length === 1) return this.placeStep('hiddenSingle', cell, h, `${h} has only one place left in column ${c + 1}: ${this.cellText(cell)}`);
    }
    return null;
  }

  /** How many empty cells are placeable as a single right now — the opportunity density. */
  private countOpenSingles(): number {
    const N = this.size;
    let open = 0;
    for (let cell = 0; cell < N * N; cell++) if (this.valueOf(cell) === 0 && popcount(this.cands[cell]) === 1) open += 1;
    return open;
  }

  /** Mean candidates per empty cell (1.0 when nothing is empty). */
  meanCandidates(): number {
    const N = this.size;
    let total = 0;
    let empties = 0;
    for (let cell = 0; cell < N * N; cell++) {
      if (this.valueOf(cell) !== 0) continue;
      empties += 1;
      total += popcount(this.cands[cell]);
    }
    return empties === 0 ? 1 : total / empties;
  }

  placedCount(): number {
    return this.grid.flat().filter((h) => h > 0).length;
  }

  solve(options: { maxTier?: SkyscrapersTier; disable?: readonly SkyscrapersTechnique[]; recordSteps?: boolean } = {}): SkyscrapersSolveResult {
    const cap = options.maxTier ?? 5;
    const disabled = new Set(options.disable ?? []);
    const recordSteps = options.recordSteps ?? false;
    const techniqueCounts: Partial<Record<SkyscrapersTechnique, number>> = {};
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

/** The structural levers of the research (§3) plus what tiers 1–2 alone achieve. */
export function measureSkyscrapers(shape: SkyscrapersShape): SkyscrapersMetrics {
  const N = shape.gridSize;
  const { clues } = shape;
  let trivialClues = 0;
  for (const side of GUTTER_SIDES) for (let i = 0; i < N; i++) { const c = clueAt(clues, side, i); if (c === 1 || c === N) trivialClues += 1; }
  let facingSumPairs = 0;
  for (let i = 0; i < N; i++) {
    if (clueAt(clues, 'left', i) + clueAt(clues, 'right', i) === N + 1 && clueAt(clues, 'left', i) > 0 && clueAt(clues, 'right', i) > 0) facingSumPairs += 1;
    if (clueAt(clues, 'top', i) + clueAt(clues, 'bottom', i) === N + 1 && clueAt(clues, 'top', i) > 0 && clueAt(clues, 'bottom', i) > 0) facingSumPairs += 1;
  }
  const tier1 = new SkyscrapersLogicalSolver(shape);
  tier1.solve({ maxTier: 1 });
  const tier2 = new SkyscrapersLogicalSolver(shape);
  tier2.solve({ maxTier: 2 });
  const present = presentClueCount(clues);
  return {
    size: N,
    presentClues: present,
    blankClues: 4 * N - present,
    trivialClues,
    facingSumPairs,
    fixed: tier1.placedCount(),
    implied: tier2.placedCount(),
    rating: tier2.meanCandidates(),
  };
}

/** What `classifySkyscrapers` returns: the grade, the solve it rests on, and the metrics when asked for. */
export interface SkyscrapersClassification {
  /** The tier, or `null` when the ladder cannot finish the puzzle (no guessing — D6). */
  tier: SkyscrapersTier | null;
  difficulty: SkyscrapersDifficulty;
  result: SkyscrapersSolveResult;
  metrics?: SkyscrapersMetrics;
}

/** Grade a puzzle: the hardest tier the ladder needed, or `'unrated'` if it could not finish. */
export function classifySkyscrapers(shape: SkyscrapersShape, options: { metrics?: boolean } = {}): SkyscrapersClassification {
  const result = new SkyscrapersLogicalSolver(shape).solve({ recordSteps: true });
  const metrics = options.metrics ? measureSkyscrapers(shape) : undefined;
  if (!result.solved) return { tier: null, difficulty: 'unrated', result, metrics };
  const tier = result.hardestTier === 0 ? 1 : result.hardestTier;
  return { tier, difficulty: TIER_DIFFICULTY[tier as Exclude<SkyscrapersTier, 0>], result, metrics };
}

export interface SkyscrapersHint {
  cell: number;
  digit: number;
  technique: SkyscrapersTechnique;
  tier: SkyscrapersTier;
  explanation: string;
  /** The eliminations that led there, oldest first. */
  leadUp: string[];
}

/**
 * The next placement the logical solver would make from the player's grid, with its technique,
 * its reason, and the eliminations that led to it. With `preferCell`, every placing technique is
 * first confined to that cell (eliminations run anywhere), so the selected cell is placed the
 * moment the board makes it deducible — by a clue-N climb as much as by a single; only when no
 * rule can place it does the ladder place elsewhere, and that placement is the hint. Either way
 * the first placement returns: no detour (Kakuro L13 — the lead-up cites only eliminations, so
 * every reason describes the board as the player sees it).
 */
export function explainSkyscrapersHint(
  shape: SkyscrapersShape,
  grid: readonly number[][],
  options: { cap?: SkyscrapersTier; preferCell?: number } = {}
): SkyscrapersHint | null {
  const { cap = 5, preferCell = -1 } = options;
  const solver = new SkyscrapersLogicalSolver(shape, grid);
  const leadUp: string[] = [];
  // Every step either places a cell (and returns) or removes at least one candidate bit, so the
  // walk is bounded by the grid's N² × N bits; the guard only stops a defect from looping.
  const maxSteps = shape.gridSize ** 3 + 1;
  for (let guard = 0; guard < maxSteps; guard++) {
    const step = preferCell === -1 ? solver.step(cap) : (solver.step(cap, undefined, preferCell) ?? solver.step(cap));
    if (!step) break;
    if (step.placed) {
      return { ...step.placed, technique: step.technique, tier: step.tier, explanation: step.explanation, leadUp: [...leadUp] };
    }
    leadUp.push(step.explanation);
  }
  return null;
}
