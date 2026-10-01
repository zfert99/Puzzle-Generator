/**
 * The exact Kakuro solver: counts a puzzle's solutions (stopping early at a limit, normally 2 —
 * enough to answer "is it unique?") and finds the digits that pure propagation forces from any
 * partly-filled grid (the Hint button's source).
 *
 * Shape: 9-bit candidate masks per white cell, **per-run** constraint propagation (the run is
 * Kakuro's only constraint unit — there are no houses), then MRV depth-first search with a node
 * budget. The same shape as the Killer/Keisan exact solvers, with the house machinery removed.
 * Hot paths stay monomorphic — one compiled puzzle shape, typed arrays, no per-call allocation
 * inside propagation (AGENTS.md §5). See `kakuro-solver.md` for the "why" of each step.
 */

import { ALL_DIGITS_MASK, runComboMasks } from './kakuro-combinations';
import type { Run } from './kakuro-types';

/** What the solver needs of a puzzle: its size and runs. (`KakuroPuzzle` satisfies it.) */
export interface KakuroShape {
  gridSize: number;
  runs: readonly Run[];
}

export interface KakuroCountOptions {
  /** Stop once this many solutions are found (default 2 — all a uniqueness check needs). */
  limit?: number;
  /** Give up after this many search nodes; the result then says `exhausted` (default 200,000). */
  nodeBudget?: number;
  /** Digits already placed (0 = empty), e.g. a player's grid; black cells are ignored. */
  grid?: readonly number[][];
}

export interface KakuroCountResult {
  /** Solutions found before stopping — exact when `< limit` and not `exhausted`. */
  solutions: number;
  nodes: number;
  /** The node budget ran out: `solutions` is a lower bound, not an answer. */
  exhausted: boolean;
  /** The first solution found (interior grid, 0 on black cells), or `null` if none. */
  solution: number[][] | null;
}

export interface KakuroDeduction {
  /** Empty cells whose digit propagation alone forces, as flat interior indices. */
  forced: { cell: number; digit: number }[];
  /** The given grid cannot be completed — some cell lost every candidate. */
  contradiction: boolean;
}

/** Number of set bits in a 9-bit mask. */
function popcount(mask: number): number {
  let m = mask;
  m -= (m >>> 1) & 0x55555555;
  m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
  return (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** 1-based digit of a single-bit mask. */
function digitOf(bit: number): number {
  return 32 - Math.clz32(bit);
}

/**
 * A puzzle compiled into flat typed arrays once per solve. Every white cell knows its two runs
 * (`cellRuns`, two slots per cell, −1 when absent); every run knows its cells and its
 * combination masks. Black cells (in no run) have both slots at −1 and are never visited.
 */
interface Compiled {
  cellCount: number;
  whites: Int32Array;
  cellRuns: Int32Array;
  runCells: Int32Array[];
  runCombos: (readonly number[])[];
  /**
   * Work queue of run ids — a ring buffer of `runs.length` slots with a membership flag, so a
   * run is queued at most once at a time and the ring can never overflow.
   */
  queue: Int32Array;
  queued: Uint8Array;
}

function compile(shape: KakuroShape): Compiled {
  const { gridSize, runs } = shape;
  const cellCount = gridSize * gridSize;
  const cellRuns = new Int32Array(cellCount * 2).fill(-1);
  const runCells: Int32Array[] = [];
  const runCombos: (readonly number[])[] = [];

  runs.forEach((run, runIndex) => {
    runCells.push(Int32Array.from(run.cells));
    runCombos.push(runComboMasks(run.cells.length, run.sum));
    const slot = run.dir === 'across' ? 0 : 1;
    for (const cell of run.cells) cellRuns[cell * 2 + slot] = runIndex;
  });

  const whites: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    if (cellRuns[cell * 2] !== -1 || cellRuns[cell * 2 + 1] !== -1) whites.push(cell);
  }

  return {
    cellCount,
    whites: Int32Array.from(whites),
    cellRuns,
    runCells,
    runCombos,
    queue: new Int32Array(runs.length),
    queued: new Uint8Array(runs.length),
  };
}

/** Candidate masks for a starting grid: a placed digit is a singleton, an empty white is 1–9. */
function initialMasks(compiled: Compiled, gridSize: number, grid?: readonly number[][]): Int32Array {
  const masks = new Int32Array(compiled.cellCount);
  for (const cell of compiled.whites) {
    const placed = grid ? grid[Math.floor(cell / gridSize)][cell % gridSize] : 0;
    masks[cell] = placed > 0 ? 1 << (placed - 1) : ALL_DIGITS_MASK;
  }
  return masks;
}

/**
 * Propagate every queued run to a fixpoint. Returns `false` on contradiction (a cell with no
 * candidates left, or a run with no feasible combination).
 *
 * Per run, three deductions, all from the surviving combinations:
 * 1. A combination is **feasible** only if every one of its digits is still a candidate in
 *    some cell AND every cell still has a candidate in it. (Necessary, not sufficient — the
 *    search covers the rest — and cheap enough to run at every node.)
 * 2. **Union:** a cell can only hold a digit that some feasible combination contains.
 * 3. **Required digits:** a digit in *every* feasible combination must be placed in the run;
 *    if only one cell can hold it, that cell is forced. Plus the plain all-different rule: a
 *    cell down to one digit removes it from its run-mates.
 * Any change re-queues the changed cell's *other* run, so a deduction crosses from across
 * runs to down runs and back until nothing moves.
 */
function propagate(compiled: Compiled, masks: Int32Array, queueLength: number): boolean {
  const { cellRuns, runCells, runCombos, queue, queued } = compiled;
  const ring = queue.length;
  let head = 0;
  let tail = queueLength % ring;
  let pending = queueLength;

  const enqueue = (runIndex: number) => {
    if (queued[runIndex] === 0) {
      queued[runIndex] = 1;
      queue[tail] = runIndex;
      tail = (tail + 1) % ring;
      pending++;
    }
  };
  const enqueueOther = (cell: number, runIndex: number) => {
    const other = cellRuns[cell * 2] === runIndex ? cellRuns[cell * 2 + 1] : cellRuns[cell * 2];
    if (other !== -1) enqueue(other);
  };

  while (pending > 0) {
    const runIndex = queue[head];
    head = (head + 1) % ring;
    pending--;
    queued[runIndex] = 0;
    const cells = runCells[runIndex];
    const combos = runCombos[runIndex];
    const length = cells.length;

    let cellsUnion = 0;
    let fixedMask = 0;
    for (let i = 0; i < length; i++) {
      const mask = masks[cells[i]];
      cellsUnion |= mask;
      if ((mask & (mask - 1)) === 0) {
        if ((fixedMask & mask) !== 0) return false; // two cells fixed to the same digit
        fixedMask |= mask;
      }
    }

    let union = 0;
    let required = ALL_DIGITS_MASK;
    for (let k = 0; k < combos.length; k++) {
      const combo = combos[k];
      if ((combo & ~cellsUnion) !== 0 || (fixedMask & ~combo) !== 0) continue;
      let feasible = true;
      for (let i = 0; i < length; i++) {
        if ((masks[cells[i]] & combo) === 0) {
          feasible = false;
          break;
        }
      }
      if (!feasible) continue;
      union |= combo;
      required &= combo;
    }
    if (union === 0) return false;

    let rerun = false;
    for (let i = 0; i < length; i++) {
      const cell = cells[i];
      const before = masks[cell];
      const wasFixed = (before & (before - 1)) === 0;
      // Union, then all-different: an unfixed cell drops every digit fixed elsewhere in the run.
      let after = before & union;
      if (!wasFixed) after &= ~fixedMask;
      if (after === 0) return false;
      if (after !== before) {
        masks[cell] = after;
        if ((after & (after - 1)) === 0) {
          // Newly fixed: cells earlier in this loop didn't see it — pass over the run again.
          fixedMask |= after;
          rerun = true;
        }
        enqueueOther(cell, runIndex);
      }
    }

    // Required digits: a digit every feasible combination needs, which only one cell can hold.
    let needed = required & ~fixedMask;
    while (needed !== 0) {
      const bit = needed & -needed;
      needed &= needed - 1;
      let holder = -1;
      let count = 0;
      for (let i = 0; i < length; i++) {
        if ((masks[cells[i]] & bit) !== 0) {
          holder = cells[i];
          if (++count > 1) break;
        }
      }
      if (count === 0) return false;
      if (count === 1 && masks[holder] !== bit) {
        masks[holder] = bit;
        fixedMask |= bit;
        enqueueOther(holder, runIndex);
        rerun = true; // the run's other cells must drop this digit too
      }
    }

    if (rerun) enqueue(runIndex);
  }
  return true;
}

/** Queue every run and propagate from scratch. */
function propagateAll(compiled: Compiled, masks: Int32Array): boolean {
  const { queue, queued } = compiled;
  for (let i = 0; i < queue.length; i++) {
    queue[i] = i;
    queued[i] = 1;
  }
  return propagate(compiled, masks, queue.length);
}

/**
 * Count a puzzle's solutions, stopping at `limit`. A uniqueness check is `limit: 2` (the
 * default): one solution found and the search finishing means unique; two means not.
 *
 * MRV search: always branch on the empty cell with the fewest candidates, propagating after
 * each placement. The masks are copied per branch (one `Int32Array` of `cellCount` per node)
 * rather than undone — simpler than trail-based undo and cheap at these sizes.
 */
export function countKakuroSolutions(shape: KakuroShape, options: KakuroCountOptions = {}): KakuroCountResult {
  const { limit = 2, nodeBudget = 200_000, grid } = options;
  const compiled = compile(shape);
  const { whites, cellRuns, queue, queued } = compiled;
  const result: KakuroCountResult = { solutions: 0, nodes: 0, exhausted: false, solution: null };

  const masks = initialMasks(compiled, shape.gridSize, grid);
  if (!propagateAll(compiled, masks)) return result;

  const record = (solved: Int32Array) => {
    const size = shape.gridSize;
    const out: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(0));
    for (const cell of whites) out[Math.floor(cell / size)][cell % size] = digitOf(solved[cell]);
    result.solution = out;
  };

  // Returns true to stop the whole search (limit reached or budget exhausted).
  const search = (current: Int32Array): boolean => {
    if (++result.nodes > nodeBudget) {
      result.exhausted = true;
      return true;
    }
    let best = -1;
    let bestCount = 10;
    for (let i = 0; i < whites.length; i++) {
      const cell = whites[i];
      const count = popcount(current[cell]);
      if (count > 1 && count < bestCount) {
        best = cell;
        bestCount = count;
        if (count === 2) break;
      }
    }
    if (best === -1) {
      if (result.solutions === 0) record(current);
      result.solutions++;
      return result.solutions >= limit;
    }

    let remaining = current[best];
    while (remaining !== 0) {
      const bit = remaining & -remaining;
      remaining &= remaining - 1;
      const next = current.slice();
      next[best] = bit;
      queued.fill(0);
      let queueLength = 0;
      const across = cellRuns[best * 2];
      const down = cellRuns[best * 2 + 1];
      if (across !== -1) { queue[queueLength++] = across; queued[across] = 1; }
      if (down !== -1) { queue[queueLength++] = down; queued[down] = 1; }
      if (propagate(compiled, next, queueLength) && search(next)) return true;
    }
    return false;
  };

  search(masks);
  return result;
}

/**
 * Is the puzzle uniquely solvable? `true` / `false` when the search finished, `null` when the
 * node budget ran out first (an answer the caller must not treat as either).
 */
export function isKakuroUnique(shape: KakuroShape, nodeBudget?: number): boolean | null {
  const result = countKakuroSolutions(shape, { limit: 2, nodeBudget });
  if (result.exhausted) return null;
  return result.solutions === 1;
}

/**
 * What propagation alone forces from a grid — no search. The Hint button's source: a cell
 * listed here is one a solver *deduced*, not one copied from the answer. `contradiction` means
 * the grid as it stands (a player's wrong entries included) cannot be completed, so nothing
 * listed should be trusted.
 */
export function deduceKakuro(shape: KakuroShape, grid: readonly number[][]): KakuroDeduction {
  const compiled = compile(shape);
  const masks = initialMasks(compiled, shape.gridSize, grid);
  if (!propagateAll(compiled, masks)) return { forced: [], contradiction: true };

  const size = shape.gridSize;
  const forced: { cell: number; digit: number }[] = [];
  for (const cell of compiled.whites) {
    if (grid[Math.floor(cell / size)][cell % size] !== 0) continue;
    const mask = masks[cell];
    if ((mask & (mask - 1)) === 0) forced.push({ cell, digit: digitOf(mask) });
  }
  return { forced, contradiction: false };
}
