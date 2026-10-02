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
 * compiled puzzle shape, typed arrays, scratch buffers allocated once, survivor lists shared
 * down the search tree and copied only when narrowed (AGENTS.md §5).
 * See `skyscrapers-solver.md` for the "why" of each step.
 */

import { digitOfBit, popcount } from '../grid-utils';
import { bucketIndex, permutationTable, type PermutationTable } from './skyscrapers-visibility';
import { lineCells as lineCellsOf, type SkyscraperClues } from './skyscrapers-types';

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
  /** Scratch for `filterLine`: the OR of surviving heights per position. Reused, never reallocated. */
  positionMasks: Int32Array;
}

/** A line whose clue pair admits nothing — a clue outside 0..N, or a pair that cannot both hold. */
const EMPTY_BUCKET = new Int32Array(0);

function compile(shape: SkyscrapersShape): Compiled {
  const size = shape.gridSize;
  const table = permutationTable(size);
  const { clues } = shape;
  const lineCells: Int32Array[] = [];
  const lineBucket: Int32Array[] = [];
  const cellLines = new Int32Array(size * size * 2);
  // A clue the puzzle cannot hold (outside 0..N, or not an integer) must never become an index
  // past the (N+1)² buckets — it is a contradiction, so the line gets the empty list. The
  // validator rejects such puzzles, but the solver is also reached from persisted data.
  const bucketFor = (left: number | undefined, right: number | undefined): Int32Array => {
    const l = left ?? 0;
    const r = right ?? 0;
    const valid = (clue: number) => Number.isInteger(clue) && clue >= 0 && clue <= size;
    return valid(l) && valid(r) ? table.buckets[bucketIndex(size, l, r)] : EMPTY_BUCKET;
  };

  // Rows read from the left clue, columns from the top clue — the shared `lineCells` convention,
  // so a bucket's `visLeft` is the left/top clue and `visRight` the right/bottom one.
  for (let r = 0; r < size; r++) {
    const cells = Int32Array.from(lineCellsOf(size, 'left', r));
    for (const cell of cells) cellLines[cell * 2] = r;
    lineCells.push(cells);
    lineBucket.push(bucketFor(clues.left[r], clues.right[r]));
  }
  for (let c = 0; c < size; c++) {
    const cells = Int32Array.from(lineCellsOf(size, 'top', c));
    for (const cell of cells) cellLines[cell * 2 + 1] = size + c;
    lineCells.push(cells);
    lineBucket.push(bucketFor(clues.top[c], clues.bottom[c]));
  }

  return {
    size,
    table,
    lineCells,
    lineBucket,
    cellLines,
    queue: new Int32Array(size * 2),
    queued: new Uint8Array(size * 2),
    positionMasks: new Int32Array(size),
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
 * the kept heights per position (into `compiled.positionMasks`), and let the caller AND that
 * into the cells. Returns the list to keep — the **same** array when nothing was dropped — or
 * `null` when no permutation survives (a contradiction).
 *
 * Copy-on-narrow: a node shares its parent's lists until it actually drops something from one.
 * When it does, an `owned` list is compacted in place; a borrowed one is copied first. So the
 * first pass only scans, and the (rarer) narrowing pass does the writing — a node that touches
 * a 5,040-entry blank-clue line without narrowing it pays no copy at all.
 */
function filterLine(
  compiled: Compiled,
  masks: Int32Array,
  cells: Int32Array,
  survivors: Int32Array,
  owned: boolean
): Int32Array | null {
  const { size, table, positionMasks } = compiled;
  const heights = table.heights;
  positionMasks.fill(0);
  const length = survivors.length;
  let out = survivors;
  let narrowed = false;
  let kept = 0;

  // One pass, no closures (this is the hot loop). Until the first drop, every kept index equals
  // its scan index, so nothing is written; at the first drop a borrowed list is copied up to
  // that point and writes begin — an owned list is compacted in place (kept ≤ k always).
  for (let k = 0; k < length; k++) {
    const p = survivors[k];
    const base = p * size;
    let ok = true;
    for (let i = 0; i < size; i++) {
      if ((masks[cells[i]] & (1 << (heights[base + i] - 1))) === 0) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      if (!narrowed) {
        narrowed = true;
        if (!owned) {
          out = new Int32Array(length);
          out.set(survivors.subarray(0, k));
        }
      }
      continue;
    }
    if (narrowed) out[kept] = p;
    kept++;
    for (let i = 0; i < size; i++) positionMasks[i] |= 1 << (heights[base + i] - 1);
  }
  if (!narrowed) return survivors; // nothing dropped: the list is unchanged, no copy
  if (kept === 0) return null;
  return out.subarray(0, kept);
}

/**
 * Propagate every queued line to a fixpoint. A cell whose mask shrinks re-queues its *other*
 * line, so a deduction crosses from rows to columns and back until nothing moves. Returns
 * `false` on contradiction.
 */
function propagate(
  compiled: Compiled,
  masks: Int32Array,
  survivors: Int32Array[],
  owned: Uint8Array,
  queueLength: number
): boolean {
  const { size, lineCells, cellLines, queue, queued, positionMasks } = compiled;
  const ring = queue.length;
  let head = 0;
  let tail = queueLength % ring;
  let pending = queueLength;

  while (pending > 0) {
    const line = queue[head];
    head = (head + 1) % ring;
    pending--;
    queued[line] = 0;

    const cells = lineCells[line];
    const kept = filterLine(compiled, masks, cells, survivors[line], owned[line] === 1);
    if (kept === null) return false;
    if (kept !== survivors[line]) {
      survivors[line] = kept;
      owned[line] = 1; // narrowed: whatever we hold now is ours (compacted in place, or a fresh copy)
    }
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
function propagateAll(compiled: Compiled, masks: Int32Array, survivors: Int32Array[], owned: Uint8Array): boolean {
  const { queue, queued } = compiled;
  for (let line = 0; line < queue.length; line++) {
    queue[line] = line;
    queued[line] = 1;
  }
  return propagate(compiled, masks, survivors, owned, queue.length);
}

/**
 * The starting lists are the table's own buckets, borrowed (never written): `owned` starts all
 * zero, and the first narrowing of a line copies it. The table is shared by every solve.
 */
function initialSurvivors(compiled: Compiled): Int32Array[] {
  return compiled.lineBucket.slice();
}

/**
 * Count the puzzle's solutions up to `limit`, from an optional starting grid. Propagation
 * first; then MRV search on the cell with the fewest candidates, re-propagating its two lines
 * after each trial height. Each node copies the masks and the *array* of list references; a
 * list itself is copied only when the node first narrows it (copy-on-narrow, tracked by `owned`),
 * so a blank-clue line's 5,040-entry list is shared down the tree until a cell in it is set.
 */
export function countSkyscrapersSolutions(shape: SkyscrapersShape, options: SkyscrapersCountOptions = {}): SkyscrapersCountResult {
  const { limit = 2, nodeBudget = 200_000, grid } = options;
  const result: SkyscrapersCountResult = { solutions: 0, nodes: 0, exhausted: false, solution: null };
  if (shape.gridSize < 1) return result;
  const compiled = compile(shape);
  const { size, cellLines, queue, queued } = compiled;

  const masks = initialMasks(compiled, grid);
  const survivors = initialSurvivors(compiled);
  const owned = new Uint8Array(survivors.length);
  if (!propagateAll(compiled, masks, survivors, owned)) return result;

  const record = (solved: Int32Array) => {
    const out: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(0));
    for (let cell = 0; cell < size * size; cell++) out[Math.floor(cell / size)][cell % size] = digitOfBit(solved[cell]);
    result.solution = out;
  };

  // Returns true to stop the whole search (limit reached or budget exhausted).
  const search = (current: Int32Array, lines: Int32Array[]): boolean => {
    // `lines` is this node's own array of references; a child borrows every list again.
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
      const nextLines = lines.slice();
      const nextOwned = new Uint8Array(lines.length); // borrowed from the parent until narrowed
      queued.fill(0);
      queue[0] = row;
      queue[1] = column;
      queued[row] = 1;
      queued[column] = 1;
      if (propagate(compiled, next, nextLines, nextOwned, 2) && search(next, nextLines)) return true;
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
  if (!propagateAll(compiled, masks, survivors, new Uint8Array(survivors.length))) return { forced: [], contradiction: true };

  const { size } = compiled;
  const forced: { cell: number; digit: number }[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    if (grid[Math.floor(cell / size)][cell % size] !== 0) continue;
    const mask = masks[cell];
    if ((mask & (mask - 1)) === 0) forced.push({ cell, digit: digitOfBit(mask) });
  }
  return { forced, contradiction: false };
}
