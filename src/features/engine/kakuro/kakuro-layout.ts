/**
 * Kakuro layout logic: turning a black/white mask into runs, and checking that a mask is a
 * legal, shippable Kakuro shape (plan decision D9) before anything expensive is run on it.
 *
 * Everything here reads the **interior** N×N only. The layout generator (slice E4) will live in
 * this module too; for now it holds the two functions hand-authored fixtures need.
 *
 * See `kakuro-layout.md` for the "why" behind each rule.
 */

import { MAX_RUN_LENGTH, MIN_RUN_LENGTH, type Run, type RunDirection } from './kakuro-types';

/** A maximal strip of white cells in one direction — a run before it has a sum. */
interface Strip {
  dir: RunDirection;
  /** Flat interior indices in reading order. */
  cells: number[];
}

/**
 * All-white rectangles at or beyond these sizes always contain a sum-preserving digit swap, so
 * no clue set can make the puzzle unique (Mathimagics, research gap G10). `[short, long]` side.
 */
const CRITICAL_RECTANGLES: readonly (readonly [number, number])[] = [
  [2, 9],
  [3, 8],
  [4, 7],
  [5, 5],
];

/**
 * Per interior size N: the most white cells, and the fewest interior black cells, any
 * uniquely-solvable layout has been found to carry (Mathimagics' table, G10). Sizes outside the
 * table are simply not bounded by this check.
 */
const UNIQUENESS_BOUNDS: Readonly<Record<number, { maxWhites: number; minInteriorBlacks: number }>> = {
  5: { maxWhites: 15, minInteriorBlacks: 1 },
  6: { maxWhites: 24, minInteriorBlacks: 1 },
  7: { maxWhites: 34, minInteriorBlacks: 2 },
  8: { maxWhites: 46, minInteriorBlacks: 3 },
  9: { maxWhites: 59, minInteriorBlacks: 5 },
  10: { maxWhites: 74, minInteriorBlacks: 7 },
  11: { maxWhites: 88, minInteriorBlacks: 12 },
  12: { maxWhites: 108, minInteriorBlacks: 13 },
  13: { maxWhites: 128, minInteriorBlacks: 16 },
  14: { maxWhites: 148, minInteriorBlacks: 21 },
  15: { maxWhites: 172, minInteriorBlacks: 24 },
  16: { maxWhites: 196, minInteriorBlacks: 29 },
};

/** The black/white mask of a solution grid: a cell is white when it holds a digit (D3). */
export function whiteMaskOf(solution: readonly number[][]): boolean[][] {
  return solution.map((row) => row.map((digit) => digit > 0));
}

/**
 * Every maximal white strip, across then down, INCLUDING length-1 strips. Keeping the length-1
 * ones is deliberate: they are exactly the orphan cells the layout validator must report, and
 * `deriveRuns` filters them out itself.
 */
function scanStrips(white: readonly boolean[][]): Strip[] {
  const size = white.length;
  const strips: Strip[] = [];

  const scanLine = (dir: RunDirection, line: number) => {
    let cells: number[] = [];
    for (let i = 0; i <= size; i++) {
      const isWhite = i < size && (dir === 'across' ? white[line][i] : white[i][line]);
      if (isWhite) {
        cells.push(dir === 'across' ? line * size + i : i * size + line);
      } else if (cells.length > 0) {
        strips.push({ dir, cells });
        cells = [];
      }
    }
  };

  for (let row = 0; row < size; row++) scanLine('across', row);
  for (let col = 0; col < size; col++) scanLine('down', col);
  return strips;
}

/**
 * Derive a solved grid's runs: every maximal strip of 2+ white cells becomes a run whose `sum`
 * is the total of its solution digits. Across runs first (row by row), then down runs (column
 * by column); ids are that order's index, so they are stable for a given grid.
 *
 * The clues are *computed from* the solution rather than stored beside it, so a puzzle built
 * this way cannot carry a clue that disagrees with its own answer.
 */
export function deriveRuns(solution: readonly number[][]): Run[] {
  const size = solution.length;
  return scanStrips(whiteMaskOf(solution))
    .filter((strip) => strip.cells.length >= MIN_RUN_LENGTH)
    .map((strip, id) => ({
      id,
      dir: strip.dir,
      cells: strip.cells,
      sum: strip.cells.reduce((sum, cell) => sum + solution[Math.floor(cell / size)][cell % size], 0),
    }));
}

function isWhiteRegionConnected(white: readonly boolean[][], whiteCount: number): boolean {
  const size = white.length;
  const start = white.flat().indexOf(true);
  if (start === -1) return false;

  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    const row = Math.floor(cell / size);
    const col = cell % size;
    const neighbors: [number, number][] = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ];
    for (const [r, c] of neighbors) {
      const next = r * size + c;
      if (r >= 0 && r < size && c >= 0 && c < size && white[r][c] && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === whiteCount;
}

/** Is there an all-white `height × width` window anywhere in the mask? */
function hasWhiteRectangle(white: readonly boolean[][], height: number, width: number): boolean {
  const size = white.length;
  for (let top = 0; top + height <= size; top++) {
    for (let left = 0; left + width <= size; left++) {
      let allWhite = true;
      for (let r = top; allWhite && r < top + height; r++) {
        for (let c = left; c < left + width; c++) {
          if (!white[r][c]) {
            allWhite = false;
            break;
          }
        }
      }
      if (allWhite) return true;
    }
  }
  return false;
}

/**
 * Check that a black/white mask is a shippable Kakuro layout (D9), returning a list of
 * human-readable problems (empty array = valid).
 *
 * Rules: square; every white cell sits in an across strip AND a down strip of length 2–9; the
 * white region is one connected piece; the mask is 180° rotationally symmetric; it contains no
 * all-white rectangle of a critical size; and its white / interior-black counts are inside the
 * published bounds for its size.
 *
 * These are all *static* — none needs a solver — which is the point: they reject layouts that
 * could never be unique before the expensive uniqueness count is ever run.
 */
export function validateKakuroLayout(white: readonly boolean[][]): string[] {
  const size = white.length;
  const errors: string[] = [];

  if (size === 0 || white.some((row) => row.length !== size)) {
    return ['layout is not a non-empty square'];
  }

  for (const strip of scanStrips(white)) {
    const { length } = strip.cells;
    if (length < MIN_RUN_LENGTH) {
      errors.push(`cell ${strip.cells[0]}: has no ${strip.dir} run (a lone white cell)`);
    } else if (length > MAX_RUN_LENGTH) {
      errors.push(`${strip.dir} run at cell ${strip.cells[0]}: length ${length} exceeds ${MAX_RUN_LENGTH}`);
    }
  }

  const whiteCount = white.flat().filter(Boolean).length;
  if (!isWhiteRegionConnected(white, whiteCount)) {
    errors.push('white cells are not one connected region');
  }

  const isSymmetric = white.every((row, r) =>
    row.every((cell, c) => cell === white[size - 1 - r][size - 1 - c])
  );
  if (!isSymmetric) errors.push('layout is not 180° rotationally symmetric');

  for (const [short, long] of CRITICAL_RECTANGLES) {
    if (hasWhiteRectangle(white, short, long) || hasWhiteRectangle(white, long, short)) {
      errors.push(`contains an all-white ${short}×${long} rectangle (never uniquely solvable)`);
    }
  }

  const bounds = UNIQUENESS_BOUNDS[size];
  if (bounds) {
    const blackCount = size * size - whiteCount;
    if (whiteCount > bounds.maxWhites) {
      errors.push(`${whiteCount} white cells exceeds the ${size}×${size} ceiling of ${bounds.maxWhites}`);
    }
    if (blackCount < bounds.minInteriorBlacks) {
      errors.push(`${blackCount} interior black cells is below the ${size}×${size} floor of ${bounds.minInteriorBlacks}`);
    }
  }

  return errors;
}
