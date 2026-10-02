/**
 * Skyscrapers (Towers) data shapes, display geometry, and the validator that keeps a puzzle's
 * clues honest against its solution (plan slices V0–V1).
 *
 * A Skyscrapers puzzle is an N×N **Latin square** of heights 1..N — every row and column holds
 * each height once, no boxes — plus **edge clues** on all four sides, each the number of towers
 * visible from that edge looking inward (a taller tower hides every shorter one behind it).
 * Those two rules are the whole constraint model; see `skyscrapers-types.md` for the "why"
 * behind the storage decisions (D2, D3) and for why the display helpers live here (L2).
 */

import { isLatinSquare } from '../grid-utils';
import type { GridConfig, GridSize } from '../sudoku';

export type SkyscrapersDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme' | 'unrated';

/**
 * The five published tiers, in order — the one list the generate form, the `/api` routes and
 * the fixtures iterate (the Kakuro review-5 lesson: one source, not three hand-typed copies).
 */
export const SKYSCRAPERS_LADDER = ['easy', 'medium', 'hard', 'expert', 'extreme'] as const satisfies readonly SkyscrapersDifficulty[];
export type SkyscrapersLevel = (typeof SKYSCRAPERS_LADDER)[number];

/**
 * The sizes Skyscrapers ships (D4, settled by E3's measurement): mini 5×5, standard 6×6, large
 * 7×7. 9×9 failed both of E3's gates and 4×4 has no expert tier — neither is served.
 */
export const SKYSCRAPERS_SIZES = [5, 6, 7] as const satisfies readonly GridSize[];
export type SkyscrapersSize = (typeof SKYSCRAPERS_SIZES)[number];

/** Type guard for the served sizes — the pickers narrow a generic size with it instead of casting. */
export function isSkyscrapersSize(value: unknown): value is SkyscrapersSize {
  return (SKYSCRAPERS_SIZES as readonly unknown[]).includes(value);
}

/**
 * The tiers each size offers (D12, settled by E3/E4's measurements). The 5×5 mini ships
 * easy / medium / hard — hard is the rare one there (8% of squares) but reachable in tens of
 * milliseconds; expert and extreme are locked as on every other mini. The 6×6 standard offers
 * the full ladder. The 7×7 large starts at medium: an easy 7×7 floor is one square in fifty
 * (3.5 s per puzzle, E4), not a tier to promise. Lives here, beside the sizes, because the play
 * menu and the print form read it in the client bundle — the generator must not ride along.
 */
export const SKYSCRAPERS_TIERS_BY_SIZE: Record<SkyscrapersSize, readonly SkyscrapersLevel[]> = {
  5: ['easy', 'medium', 'hard'],
  6: ['easy', 'medium', 'hard', 'expert', 'extreme'],
  7: ['medium', 'hard', 'expert', 'extreme'],
};

/** Whether a size offers a level — the one check the routes, the pickers and the generator share. */
export function isSkyscrapersLevelOffered(gridSize: SkyscrapersSize, level: SkyscrapersLevel): boolean {
  return SKYSCRAPERS_TIERS_BY_SIZE[gridSize].includes(level);
}

/** Which strip of the clue gutter a display cell belongs to. */
export type GutterSide = 'top' | 'bottom' | 'left' | 'right';

export const GUTTER_SIDES: readonly GutterSide[] = ['top', 'bottom', 'left', 'right'];

/**
 * The edge clues, one array per side of length N, indexed along the side (`top[c]` and
 * `bottom[c]` both look at column `c`; `left[r]` and `right[r]` both look at row `r`).
 * **0 means blank** — no clue on that edge (plan decision D2). A present clue is 1..N.
 */
export interface SkyscraperClues {
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
}

/**
 * A Skyscrapers puzzle. `grid` and `solution` are the **interior** N×N only — the clue gutter a
 * player sees on every side is a rendering concern, so `grid.length === gridSize` holds here as
 * it does for every other puzzle type (D2). There are no givens at any published tier (D3), so
 * `grid` is all-zero; the slot exists so a fixture or a future "givens" lever can round-trip.
 */
export interface SkyscrapersPuzzle {
  variant: 'skyscrapers';
  gridSize: GridSize;
  grid: number[][];
  /** The solved Latin square. SERVER-ONLY for ranked dailies. */
  solution: number[][];
  clues: SkyscraperClues;
  difficulty: SkyscrapersDifficulty;
}

/**
 * Board/engine config for a Skyscrapers grid: boxless at **every** size — a 6×6 Skyscrapers has
 * no 2×3 boxes, unlike `getGridConfig(6)` — with heights 1..N (`maxNum = size`). The row-strip
 * sentinel (`boxWidth = size, boxHeight = 1`) is the same one Keisan's `calcGridConfig` uses, so
 * an ungated box reader degenerates to the row constraint instead of corrupting the square.
 */
export function skyscrapersGridConfig(size: GridSize): GridConfig {
  return { size, hasBoxes: false, boxWidth: size, boxHeight: 1, totalCells: size * size, maxNum: size };
}

/** Display tracks per axis for an interior size N: the play area plus a gutter cell on each side. */
export function skyscrapersTracks(size: number): number {
  return size + 2;
}

/**
 * One cell of the (N+2)×(N+2) picture: the N×N play area, a gutter cell on each of the four
 * sides (indexed along its side), or one of the four corners where two gutters meet.
 */
export type DisplayCell =
  | { kind: 'play'; row: number; col: number }
  | { kind: 'gutter'; side: GutterSide; index: number }
  | { kind: 'corner' };

/**
 * Expands an interior size N into the (N+2)×(N+2) display grid. Display index 0 and N+1 on
 * either axis are the gutter; display (r, c) is play cell (r − 1, c − 1). Unlike Kakuro, whose
 * clues live inside the grid and along two edges, every Skyscrapers clue sits outside the play
 * area, so the gutter is symmetric on all four sides and the corners hold nothing.
 */
export function buildDisplayCells(size: number): DisplayCell[][] {
  const tracks = skyscrapersTracks(size);
  const last = tracks - 1;
  const isEdge = (i: number) => i === 0 || i === last;

  return Array.from({ length: tracks }, (_, r) =>
    Array.from({ length: tracks }, (_, c): DisplayCell => {
      if (isEdge(r) && isEdge(c)) return { kind: 'corner' };
      if (r === 0) return { kind: 'gutter', side: 'top', index: c - 1 };
      if (r === last) return { kind: 'gutter', side: 'bottom', index: c - 1 };
      if (c === 0) return { kind: 'gutter', side: 'left', index: r - 1 };
      if (c === last) return { kind: 'gutter', side: 'right', index: r - 1 };
      return { kind: 'play', row: r - 1, col: c - 1 };
    })
  );
}

/**
 * How many towers are visible along a line read from its first element: the count of strict
 * running maxima (the first tower always counts; a 0 — an empty cell — never does, which is
 * why this is also the "visible so far" count of a partially filled line).
 */
export function visibleCount(line: readonly number[]): number {
  let tallest = 0;
  let seen = 0;
  for (const height of line) {
    if (height > tallest) {
      tallest = height;
      seen += 1;
    }
  }
  return seen;
}

/**
 * The line a clue on `side` at `index` reads, in reading order (first element nearest the clue).
 */
export function lineFor(grid: readonly (readonly number[])[], side: GutterSide, index: number): number[] {
  const size = grid.length;
  return lineCells(size, side, index).map((cell) => grid[Math.floor(cell / size)][cell % size]);
}

/**
 * The flat cell indices (`row × size + column`) a clue reads, from the clue's edge inward — the
 * one line convention every solver shares (the exact solver's compiled lines, the logical
 * solver's clued lines, and `lineFor` above), so a clue can never mean different cells to
 * different engines.
 */
export function lineCells(size: number, side: GutterSide, index: number): number[] {
  const cells: number[] = [];
  for (let d = 0; d < size; d++) {
    if (side === 'left') cells.push(index * size + d);
    else if (side === 'right') cells.push(index * size + (size - 1 - d));
    else if (side === 'top') cells.push(d * size + index);
    else cells.push((size - 1 - d) * size + index);
  }
  return cells;
}

/**
 * The clue on `side` at `index`, or 0 when it is blank **or absent**. The validator is the
 * boundary that rejects a short or missing clue array; a renderer reading through this helper
 * treats absence as blank on purpose, so a malformed puzzle degrades to empty gutter cells
 * instead of a crash in a Server Component.
 */
export function clueAt(clues: SkyscraperClues, side: GutterSide, index: number): number {
  return clues[side]?.[index] ?? 0;
}

/** How many of the 4N clues are present (non-zero) — the blank-clue lever, read the same way everywhere. */
export function presentClueCount(clues: SkyscraperClues): number {
  let present = 0;
  for (const side of GUTTER_SIDES) for (const clue of clues[side]) if (clue > 0) present += 1;
  return present;
}

/** What a clue cell shows about its line as the player fills it in (plan decision D9). */
export type ClueStatus = 'open' | 'satisfied' | 'violated';

/**
 * The state of one clue against its line as it stands, judged only on the **filled prefix** —
 * the cells from the clue's edge up to the first empty one (Tatham's `check_errors` rule,
 * gap-findings G10). A verdict here is provable from what is on the board, so it never
 * flashes red on a line the player is still working on:
 *
 * - `violated` when the prefix already shows more towers than the clue; when the tallest tower
 *   (N) is in the prefix with fewer visible than the clue (nothing behind N can ever be seen);
 *   when the prefix shows exactly the clue's count but N is still to come (it will be seen);
 *   or when the cells left cannot make up the shortfall.
 * - `satisfied` when the line is complete and the count matches.
 * - `open` otherwise. A blank clue (0) is always `open`.
 */
export function clueStatus(line: readonly number[], clue: number): ClueStatus {
  if (clue <= 0) return 'open';
  const size = line.length;
  let tallest = 0;
  let seen = 0;
  let filled = 0;
  for (const height of line) {
    if (height === 0) break;
    filled += 1;
    if (height > tallest) {
      tallest = height;
      seen += 1;
    }
  }
  if (filled === size) return seen === clue ? 'satisfied' : 'violated';
  if (seen > clue) return 'violated';
  if (tallest === size && seen < clue) return 'violated';
  if (seen === clue && tallest !== size) return 'violated';
  if (seen + (size - filled) < clue) return 'violated';
  return 'open';
}

/**
 * The flat position of a clue in a 4N-long per-puzzle array — `top` first, then `bottom`,
 * `left`, `right`, each in index order. The board keeps its "marked done" flags this way.
 */
export function clueFlatIndex(side: GutterSide, index: number, size: number): number {
  return GUTTER_SIDES.indexOf(side) * size + index;
}

/** The inverse of `clueFlatIndex`: which clue a flat position names. The one place the packing is undone. */
export function clueFromFlatIndex(flat: number, size: number): { side: GutterSide; index: number } {
  return { side: GUTTER_SIDES[Math.floor(flat / size)], index: flat % size };
}

/** Every one of the 4N clues a solved square implies — the generator's starting point (E4). */
export function deriveClues(solution: readonly (readonly number[])[]): SkyscraperClues {
  const size = solution.length;
  const sideClues = (side: GutterSide) =>
    Array.from({ length: size }, (_, index) => visibleCount(lineFor(solution, side, index)));
  return { top: sideClues('top'), bottom: sideClues('bottom'), left: sideClues('left'), right: sideClues('right') };
}

/**
 * Check every invariant a puzzle must satisfy, returning a list of human-readable problems
 * (empty array = valid) — all at once rather than throwing on the first, the choice every
 * validator in the engine makes for the same debugging reason.
 *
 * Invariants: `solution` is an N×N Latin square with N = `gridSize`; `grid` is N×N and every
 * non-zero entry agrees with the solution (there are no givens in v1, but a wrong one must not
 * pass); each clue array has length N; every present clue (non-zero) is 1..N and equals the
 * count the solution implies on that line. It does not check uniqueness — that is the exact
 * solver's job (E1).
 */
export function validateSkyscrapers(puzzle: SkyscrapersPuzzle): string[] {
  const { gridSize: size, grid, solution, clues } = puzzle;
  const errors: string[] = [];

  if (solution.length !== size) errors.push(`solution has ${solution.length} rows, expected ${size}`);
  else if (!isLatinSquare(solution, size)) errors.push('solution is not a Latin square of 1..N');

  if (grid.length !== size || grid.some((row) => row.length !== size)) {
    errors.push(`grid is not ${size}×${size}`);
  } else {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const given = grid[r][c];
        if (given !== 0 && given !== solution[r]?.[c]) {
          errors.push(`grid cell (${r}, ${c}) holds ${given}, solution has ${solution[r]?.[c]}`);
        }
      }
    }
  }

  if (errors.length > 0) return errors; // the clue checks below need a sound solution

  const implied = deriveClues(solution);
  for (const side of GUTTER_SIDES) {
    const sideClues = clues[side];
    if (sideClues.length !== size) {
      errors.push(`${side} clues: ${sideClues.length} entries, expected ${size}`);
      continue;
    }
    sideClues.forEach((clue, index) => {
      if (clue === 0) return;
      if (!Number.isInteger(clue) || clue < 1 || clue > size) {
        errors.push(`${side} clue ${index}: ${clue} is outside 1..${size}`);
      } else if (clue !== implied[side][index]) {
        errors.push(`${side} clue ${index}: ${clue} but the solution shows ${implied[side][index]}`);
      }
    });
  }

  return errors;
}
