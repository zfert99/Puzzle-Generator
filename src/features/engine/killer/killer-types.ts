/**
 * Core Killer Sudoku data shapes and the invariant validators that keep generated puzzles
 * honest. A Killer puzzle is a standard grid PLUS a set of cages (summed regions); this module
 * defines those types and the checks a valid cage partition must satisfy.
 *
 * See `killer-types.md` for the "why" behind the discriminated union and the invariants.
 */

import type { Difficulty, SudokuPuzzle } from '../sudoku';

/**
 * A cage: a connected group of cells whose solution digits sum to `sum`, with no digit
 * repeated. `cells` holds FLAT indices (`row * size + col`) — a single integer per cell is
 * cheaper to store and compare than `{r, c}` pairs, and converts back with `/` and `%`.
 */
export interface Cage {
  /** Stable id, used for React keys and cage-border lookup later. */
  id: number;
  /** Target sum of the cage's cells. */
  sum: number;
  /** Flat cell indices (`row * size + col`); length 1–9, connected, no repeated digit. */
  cells: number[];
}

/** A Killer puzzle. The `variant` tag is what lets `Puzzle` be narrowed safely (see below). */
export interface KillerPuzzle {
  variant: 'killer';
  /** Usually all-zero — Killer has no givens; the cages are the clue. */
  grid: number[][];
  /** Solved grid. SERVER-ONLY for ranked dailies. */
  solution: number[][];
  /** Cages partitioning the grid — every cell in exactly one cage. */
  cages: Cage[];
  difficulty: Difficulty;
  gridSize: 9; // v1: 9×9 only
}

/** The existing classic puzzle, tagged so it can share a union with Killer. */
export interface ClassicPuzzle extends SudokuPuzzle {
  variant: 'classic';
}

/**
 * Either kind of puzzle. The `variant` string is a DISCRIMINANT: checking `puzzle.variant`
 * narrows the type, so `puzzle.cages` is only reachable after TypeScript knows it's a Killer.
 * This forces every consumer (store, PDF, board) to handle both cases explicitly.
 */
export type Puzzle = ClassicPuzzle | KillerPuzzle;

/** The four orthogonal neighbors of a flat cell index, respecting grid edges (no wraparound). */
export function orthogonalNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const result: number[] = [];
  if (row > 0) result.push(index - size); // up
  if (row < size - 1) result.push(index + size); // down
  if (col > 0) result.push(index - 1); // left
  if (col < size - 1) result.push(index + 1); // right
  return result;
}

/**
 * Is a cage orthogonally connected — can you walk between all its cells through shared edges?
 * A flood-fill (BFS) from the first cell: reach every neighbor that's also in the cage, and
 * check we visited them all. The same neighbor logic the cage GENERATOR will use to grow
 * cages — generation builds connectivity, validation confirms it.
 */
export function isCageConnected(cells: number[], size: number): boolean {
  if (cells.length === 0) return false;
  const inCage = new Set(cells);
  const seen = new Set<number>([cells[0]]);
  const queue: number[] = [cells[0]];
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    for (const neighbor of orthogonalNeighbors(cell, size)) {
      if (inCage.has(neighbor) && !seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Check every invariant a valid Killer cage partition must satisfy against its solution,
 * returning a list of human-readable problems (empty array = valid). Returning all errors at
 * once — rather than throwing on the first — makes generator debugging far easier.
 *
 * Invariants: cages cover every cell exactly once (a true partition), each cage is connected
 * and sized 1–9, no digit repeats within a cage, and each `sum` equals its solution total.
 */
export function validateKillerCages(cages: Cage[], solution: number[][]): string[] {
  const size = solution.length;
  const cellCount = size * size;
  const coverage = new Array<number>(cellCount).fill(0);
  const errors: string[] = [];

  for (const cage of cages) {
    if (cage.cells.length < 1 || cage.cells.length > 9) {
      errors.push(`cage ${cage.id}: size ${cage.cells.length} is outside 1..9`);
    }
    if (!isCageConnected(cage.cells, size)) {
      errors.push(`cage ${cage.id}: cells are not orthogonally connected`);
    }

    const digits: number[] = [];
    for (const cell of cage.cells) {
      if (cell < 0 || cell >= cellCount) {
        errors.push(`cage ${cage.id}: cell index ${cell} is out of range`);
        continue;
      }
      coverage[cell] += 1;
      digits.push(solution[Math.floor(cell / size)][cell % size]);
    }

    if (new Set(digits).size !== digits.length) {
      errors.push(`cage ${cage.id}: a digit repeats within the cage`);
    }
    const total = digits.reduce((sum, digit) => sum + digit, 0);
    if (total !== cage.sum) {
      errors.push(`cage ${cage.id}: sum ${cage.sum} != solution total ${total}`);
    }
  }

  for (let cell = 0; cell < cellCount; cell++) {
    if (coverage[cell] === 0) errors.push(`cell ${cell}: not covered by any cage`);
    else if (coverage[cell] > 1) errors.push(`cell ${cell}: covered by ${coverage[cell]} cages`);
  }

  return errors;
}
