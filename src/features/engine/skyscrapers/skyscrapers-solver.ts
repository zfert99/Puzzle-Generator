/**
 * The exact Skyscrapers solver (plan slice E1): counts a puzzle's solutions (stopping early at
 * a limit, normally 2 — enough to answer "is it unique?") and finds the heights that pure
 * propagation forces from any partly-filled grid (the Hint button's source).
 *
 * Shape: N-bit candidate masks per cell and **per-line permutation filtering** — every row and
 * column keeps the list of permutations its clue pair admits (from `permutationTable`) and
 * narrows it against the cells' candidates; what survives is OR'd back into the cells. That one
 * step is both the Latin constraint (a permutation holds each height once) and the visibility
 * constraint (every listed permutation already matches the clues), so there is no separate
 * all-different or clue rule. Then MRV depth-first search with a node budget — the Killer /
 * Keisan / Kakuro shape with the line as the constraint unit. Hot paths stay monomorphic: one
 * compiled puzzle shape, typed arrays, survivor lists that only ever shrink (AGENTS.md §5).
 * See `skyscrapers-solver.md` for the "why" of each step.
 */

import { popcount } from '../grid-utils';
import { bucketIndex, permutationTable, type PermutationTable } from './skyscrapers-visibility';
import type { SkyscraperClues } from './skyscrapers-types';

/** What the solver needs of a puzzle: its size and clues. (`SkyscrapersPuzzle` satisfies it.) */
export interface SkyscrapersShape {
  gridSize: number;
  clues: SkyscraperClues;
}

export interface SkyscrapersCountOptions {
  /** Stop once this many solutions are found (default 2 — all a uniqueness check needs). */
  limit?: number;
  /** Give up after this many search nodes; the result then says `exhausted` (default 200,000). */
  nodeBudget?: number;
  /** Heights already placed (0 = empty), e.g. a player's grid. */
  grid?: readonly number[][];
}

export interface SkyscrapersCountResult {
  /** Solutions found before stopping — exact when `< limit` and not `exhausted`. */
  solutions: number;
  nodes: number;
  /** The node budget ran out: `solutions` is a lower bound, not an answer. */
  exhausted: boolean;
  /** The first solution found, or `null` if none. */
  solution: number[][] | null;
}

export interface SkyscrapersDeduction {
  /** Empty cells whose height propagation alone forces, as flat indices. */
  forced: { cell: number; digit: number }[];
  /** The given grid cannot be completed — some cell or line lost every option. */
  contradiction: boolean;
}

/** 1-based height of a single-bit mask (bit h−1 ↔ height h). */
function heightOf(bit: number): number {
  return 32 - Math.clz32(bit);
}

/**
 * A puzzle compiled once per solve: the table for its size, and for each of the 2N lines (rows
 * first, then columns) the flat cell indices in reading order and the bucket its clue pair
 * admits. `cellLines` gives every cell its row line and its column line.
 */
interface Compiled {
  size: number;
  table: PermutationTable;
  lineCells: Int32Array[];
  lineBucket: Int32Array[];
  /** Two slots per cell: the row line index and the column line index. */
  cellLines: Int32Array;
  queue: Int32Array;
  queued: Uint8Array;
}

function compile(shape: SkyscrapersShape): Compiled {
  const size = shape.gridSize;
  const table = permutationTable(size);
  const { clues } = shape;
  const lineCells: Int32Array[] = [];
  const lineBucket: Int32Array[] = [];
  const cellLines = new Int32Array(size * size * 2);

  for (let r = 0; r < size; r++) {
    const cells = new Int32Array(size);
    for (let c = 0; c < size; c++) {
      cells[c] = r * size + c;
      cellLines[(r * size + c) * 2] = r;
    }
    lineCells.push(cells);
    lineBucket.push(table.buckets[bucketIndex(size, clues.left[r] ?? 0, clues.right[r] ?? 0)]);
  }
  for (let c = 0; c < size; c++) {
    const cells = new Int32Array(size);
    for (let r = 0; r < size; r++) {
      cells[r] = r * size + c;
      cellLines[(r * size + c) * 2 + 1] = size + c;
    }
    lineCells.push(cells);
    lineBucket.push(table.buckets[bucketIndex(size, clues.top[c] ?? 0, clues.bottom[c] ?? 0)]);
  }

  return {
    size,
    table,
    lineCells,
    lineBucket,
    cellLines,
    queue: new Int32Array(size * 2),
    queued: new Uint8Array(size * 2),
  };
}

/** Candidate masks for a starting grid: a placed height is a singleton, an empty cell is 1..N. */
function initialMasks(compiled: Compiled, grid?: readonly number[][]): Int32Array {
  const { size } = compiled;
  const all = (1 << size) - 1;
  const masks = new Int32Array(size * size);
  for (let cell = 0; cell < size * size; cell++) {
    const placed = grid ? grid[Math.floor(cell / size)][cell % size] : 0;
    masks[cell] = placed > 0 ? 1 << (placed - 1) : all;
  }
  return masks;
}

/**
 * Narrow one line: keep the permutations compatible with every cell's current candidates, OR
 * the kept heights per position, and AND that into the cells. Returns the kept list (the same
 * array when nothing was dropped), or `null` when no permutation survives — a contradiction.
 * The survivor list only ever shrinks, so a child node can share its parent's list until it
 * narrows it (search copies the array of lists, never the lists).
 */
function filterLine(
  compiled: Compiled,
  masks: Int32Array,
  cells: Int32Array,
  survivors: Int32Array,
  positionMasks: Int32Array
): Int32Array | null {
  const { size, table } = compiled;
  const heights = table.heights;
  positionMasks.fill(0);
  let kept = 0;
  for (let k = 0; k < survivors.length; k++) {
    const p = survivors[k];
    const base = p * size;
    let ok = true;
    for (let i = 0; i < size; i++) {
      if ((masks[cells[i]] & (1 << (heights[base + i] - 1))) === 0) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    survivors[kept++] = p; // compaction in place is safe: `survivors` is this node's own copy
    for (let i = 0; i < size; i++) positionMasks[i] |= 1 << (heights[base + i] - 1);
  }
  if (kept === 0) return null;
  return kept === survivors.length ? survivors : survivors.subarray(0, kept);
}

/**
 * Propagate every queued line to a fixpoint. A cell whose mask shrinks re-queues its *other*
 * line, so a deduction crosses from rows to columns and back until nothing moves. Returns
 * `false` on contradiction.
 */
function propagate(compiled: Compiled, masks: Int32Array, survivors: Int32Array[], queueLength: number): boolean {
  const { size, lineCells, cellLines, queue, queued } = compiled;
  const ring = queue.length;
  const positionMasks = new Int32Array(size);
  let head = 0;
  let tail = queueLength % ring;
  let pending = queueLength;

  while (pending > 0) {
    const line = queue[head];
    head = (head + 1) % ring;
    pending--;
    queued[line] = 0;

    const cells = lineCells[line];
    const kept = filterLine(compiled, masks, cells, survivors[line], positionMasks);
    if (kept === null) return false;
    survivors[line] = kept;
    for (let i = 0; i < size; i++) {
      const cell = cells[i];
      const next = masks[cell] & positionMasks[i];
      if (next === 0) return false;
      if (next !== masks[cell]) {
        masks[cell] = next;
        const other = cellLines[cell * 2] === line ? cellLines[cell * 2 + 1] : cellLines[cell * 2];
        if (queued[other] === 0) {
          queued[other] = 1;
          queue[tail] = other;
          tail = (tail + 1) % ring;
          pending++;
        }
      }
    }
  }
  return true;
}

/** Queue every line and propagate — the opening move and the deduction entry point. */
function propagateAll(compiled: Compiled, masks: Int32Array, survivors: Int32Array[]): boolean {
  const { queue, queued } = compiled;
  for (let line = 0; line < queue.length; line++) {
    queue[line] = line;
    queued[line] = 1;
  }
  return propagate(compiled, masks, survivors, queue.length);
}

/** A fresh, private copy of every line's starting bucket (the lists are narrowed in place). */
function initialSurvivors(compiled: Compiled): Int32Array[] {
  return compiled.lineBucket.map((bucket) => bucket.slice());
}

/**
 * Count the puzzle's solutions up to `limit`, from an optional starting grid. Propagation
 * first; then MRV search on the cell with the fewest candidates, re-propagating its two lines
 * after each trial height. Each node copies the masks and every survivor list, because
 * `filterLine` compacts a list in place — a child must never narrow its parent's list.
 */
export function countSkyscrapersSolutions(shape: SkyscrapersShape, options: SkyscrapersCountOptions = {}): SkyscrapersCountResult {
  const { limit = 2, nodeBudget = 200_000, grid } = options;
  const result: SkyscrapersCountResult = { solutions: 0, nodes: 0, exhausted: false, solution: null };
  if (shape.gridSize < 1) return result;
  const compiled = compile(shape);
  const { size, cellLines, queue, queued } = compiled;

  const masks = initialMasks(compiled, grid);
  const survivors = initialSurvivors(compiled);
  if (!propagateAll(compiled, masks, survivors)) return result;

  const record = (solved: Int32Array) => {
    const out: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(0));
    for (let cell = 0; cell < size * size; cell++) out[Math.floor(cell / size)][cell % size] = heightOf(solved[cell]);
    result.solution = out;
  };

  // Returns true to stop the whole search (limit reached or budget exhausted).
  const search = (current: Int32Array, lines: Int32Array[]): boolean => {
    if (++result.nodes > nodeBudget) {
      result.exhausted = true;
      return true;
    }
    let best = -1;
    let bestCount = size + 1;
    for (let cell = 0; cell < size * size; cell++) {
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
    const row = cellLines[best * 2];
    const column = cellLines[best * 2 + 1];
    while (remaining !== 0) {
      const bit = remaining & -remaining;
      remaining &= remaining - 1;
      const next = current.slice();
      next[best] = bit;
      // The child narrows lists in place, so it takes its own copy of every list (2N small
      // arrays — the lists are already narrowed by the parent, so this is cheap after the first
      // few levels).
      const nextLines = lines.map((list) => list.slice());
      queued.fill(0);
      queue[0] = row;
      queue[1] = column;
      queued[row] = 1;
      queued[column] = 1;
      if (propagate(compiled, next, nextLines, 2) && search(next, nextLines)) return true;
    }
    return false;
  };

  search(masks, survivors);
  return result;
}

/** `true` if exactly one solution, `false` if zero or several, `null` if the budget ran out. */
export function isSkyscrapersUnique(shape: SkyscrapersShape, nodeBudget?: number): boolean | null {
  const result = countSkyscrapersSolutions(shape, { limit: 2, nodeBudget });
  if (result.exhausted) return null;
  return result.solutions === 1;
}

/**
 * The heights propagation alone forces from `grid` (no search). Sound: a forced height is in
 * every completion of the grid — but a grid that already holds a mistake can force heights that
 * are consistent with the mistake and wrong against the answer, so a hint must still check them
 * against the solution (Kakuro L9).
 */
export function deduceSkyscrapers(shape: SkyscrapersShape, grid: readonly number[][]): SkyscrapersDeduction {
  const compiled = compile(shape);
  const masks = initialMasks(compiled, grid);
  const survivors = initialSurvivors(compiled);
  if (!propagateAll(compiled, masks, survivors)) return { forced: [], contradiction: true };

  const { size } = compiled;
  const forced: { cell: number; digit: number }[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    if (grid[Math.floor(cell / size)][cell % size] !== 0) continue;
    const mask = masks[cell];
    if ((mask & (mask - 1)) === 0) forced.push({ cell, digit: heightOf(mask) });
  }
  return { forced, contradiction: false };
}
