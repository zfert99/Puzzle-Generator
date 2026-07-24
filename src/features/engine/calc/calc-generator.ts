/**
 * Keisan (Calcudoku) generation building blocks — K2: a boxless Latin-square fill, a region-growing
 * cage partition, operator/target assignment, and `generateUniqueCalc` (fill → cage → assign →
 * uniqueness gate). This is the UNGRADED generator; difficulty grading + the tiered pipeline are K4.
 *
 * See `calc-generator.md` for the "why".
 */

import type { GridConfig, GridSize } from '../sudoku';
import { createEmptyGrid, copyGrid, fillGrid } from '../grid-utils';
import { CalcSolver } from './calc-solver';
import {
  computeTarget,
  operatorAllowedForCageSize,
  hasAssignableOperator,
  type CalcOperator,
  type CalcCage,
} from './calc-types';

/** Keisan is always a pure Latin square — never box-constrained, even at box-tileable 4/6. */
export function calcGridConfig(size: GridSize): GridConfig {
  return { size, hasBoxes: false, boxWidth: size, boxHeight: 1, totalCells: size * size, maxNum: size };
}

/** The four orthogonal neighbours of a flat cell index, respecting grid edges (mirrors killer-types). */
function orthogonalNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const result: number[] = [];
  if (row > 0) result.push(index - size);
  if (row < size - 1) result.push(index + size);
  if (col > 0) result.push(index - 1);
  if (col < size - 1) result.push(index + 1);
  return result;
}

export interface CalcCageGenOptions {
  /** Largest cage to grow (clamped to `size`). Default 3. */
  maxSize?: number;
  /** Smallest cage to intend. Default 1. `minSize ≥ 2` suppresses intentional single-cell givens. */
  minSize?: number;
  /** Probability of drawing `maxSize` instead of a uniform `[minSize, maxSize]` pick. Default: uniform. */
  maxSizeBias?: number;
  /** Random source in [0, 1). Injectable for deterministic tests; defaults to `Math.random`. */
  rng?: () => number;
}

/**
 * Grow a partition of connected cages over `solution`. **Unlike Killer, there is no no-repeat
 * eligibility stop** (repeats are legal in Keisan), so growth terminates on the drawn target size
 * alone (or when a cage boxes itself in with no unassigned neighbours). The `maxSize` cap + the K2
 * uniqueness gate are the real quality backstops (plan §K2). Cells only; operators/targets are
 * assigned separately. Seeds are taken in scan order so every cell is covered and the loop
 * terminates; growth annexes a RANDOM unassigned neighbour for irregular shapes.
 */
export function generateCalcCageShapes(
  size: number,
  options: CalcCageGenOptions = {},
): number[][] {
  const maxSize = Math.min(options.maxSize ?? 3, size);
  const minSize = Math.max(1, Math.min(options.minSize ?? 1, maxSize));
  const rng = options.rng ?? Math.random;
  const cellCount = size * size;

  const assigned = new Array<boolean>(cellCount).fill(false);
  const shapes: number[][] = [];

  for (let seed = 0; seed < cellCount; seed++) {
    if (assigned[seed]) continue;

    const targetSize =
      options.maxSizeBias !== undefined && rng() < options.maxSizeBias
        ? maxSize
        : minSize + Math.floor(rng() * (maxSize - minSize + 1));
    const cells = [seed];
    assigned[seed] = true;

    while (cells.length < targetSize) {
      const frontier = new Set<number>();
      for (const cell of cells) {
        for (const neighbor of orthogonalNeighbors(cell, size)) {
          if (!assigned[neighbor]) frontier.add(neighbor); // no digit check — repeats are legal
        }
      }
      if (frontier.size === 0) break; // boxed in — the cage ends here

      const frontierList = [...frontier];
      const pick = frontierList[Math.floor(rng() * frontierList.length)];
      cells.push(pick);
      assigned[pick] = true;
    }

    shapes.push(cells);
  }

  return shapes;
}

/** Which operators can legally clue a cage of these solution digits, given the active set. */
function assignableOperators(
  digits: number[],
  activeOps: readonly CalcOperator[],
): CalcOperator[] {
  const size = digits.length;
  return activeOps.filter((op) => {
    if (!operatorAllowedForCageSize(op, size)) return false;
    // Division must yield an integer: larger ÷ smaller. (add/mul/sub always do.)
    if (op === 'div') {
      const hi = Math.max(digits[0], digits[1]);
      const lo = Math.min(digits[0], digits[1]);
      return hi % lo === 0;
    }
    return true;
  });
}

export interface CalcAssignOptions {
  /** Operators the generator may assign (a difficulty axis in K4). Default: all four (QuadOp). */
  activeOps?: readonly CalcOperator[];
  rng?: () => number;
}

/**
 * Turn bare cage shapes into clued `CalcCage`s by choosing an operator per cage from the active set
 * and computing its target from the solution digits.
 *
 * - **Single-cell cages are givens:** `op = 'add'`, `target = the digit` (operator is irrelevant).
 * - **Multi-cell cages** pick a random operator among those legal for the size AND (for `div`)
 *   yielding an integer target. Returns `null` if any cage has no assignable operator — the K1
 *   legality invariant should prevent this (an active set with `add`/`mul` always covers big
 *   cages), but a two-cell cage under a `÷`-only set with non-divisible digits genuinely can't be
 *   clued, so the caller regenerates rather than emit a malformed puzzle.
 */
export function assignCalcCages(
  shapes: number[][],
  solution: number[][],
  options: CalcAssignOptions = {},
): CalcCage[] | null {
  const size = solution.length;
  const activeOps = options.activeOps ?? (['add', 'sub', 'mul', 'div'] as const);
  const rng = options.rng ?? Math.random;
  const digitAt = (cell: number) => solution[Math.floor(cell / size)][cell % size];

  const cages: CalcCage[] = [];
  let id = 0;
  for (const cells of shapes) {
    const digits = cells.map(digitAt);
    if (cells.length === 1) {
      cages.push({ id: id++, op: 'add', target: digits[0], cells });
      continue;
    }
    const choices = assignableOperators(digits, activeOps);
    if (choices.length === 0) return null; // e.g. ÷-only set, non-divisible pair — regenerate
    const op = choices[Math.floor(rng() * choices.length)];
    cages.push({ id: id++, op, target: computeTarget(op, digits), cells });
  }
  return cages;
}

export interface CalcGenOptions extends CalcCageGenOptions, CalcAssignOptions {
  /** A solved Latin square to build on. Default: a fresh random one via `fillGrid` per attempt. */
  solution?: number[][];
  /** Attempts before giving up (default 200). */
  maxAttempts?: number;
  /** Node budget for the uniqueness check (default unlimited; K4 tunes it for pathological shapes). */
  verifyNodeBudget?: number;
}

/**
 * One uniquely-solvable, UNGRADED Keisan layout of the given size — the K2 building block (K4 adds
 * difficulty grading on top). A fresh random Latin square per attempt (unless one is injected)
 * avoids thrashing on an unlucky grid. Throws if no unique layout is found in `maxAttempts`.
 *
 * @throws if the active operator set can't clue the cage sizes present (the legality invariant),
 *   or if no unique layout is found in `maxAttempts`.
 */
export function generateUniqueCalc(
  size: GridSize,
  options: CalcGenOptions = {},
): { cages: CalcCage[]; solution: number[][]; gridSize: GridSize } {
  const activeOps = options.activeOps ?? (['add', 'sub', 'mul', 'div'] as const);
  const maxSize = Math.min(options.maxSize ?? 3, size);
  // Assert the legality invariant up front: every cage size we might grow needs an assignable
  // operator, or generation can silently wedge (plan §K2 / K1 `hasAssignableOperator`).
  for (let s = 2; s <= maxSize; s++) {
    if (!hasAssignableOperator(activeOps, s)) {
      throw new Error(
        `Operator set [${activeOps.join(', ')}] cannot clue a ${s}-cell cage — a 3+-cell cage needs 'add' or 'mul'.`,
      );
    }
  }

  const config = calcGridConfig(size);
  const rng = options.rng ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 200;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let solution: number[][];
    if (options.solution) {
      solution = copyGrid(options.solution);
    } else {
      solution = createEmptyGrid(size);
      fillGrid(solution, config); // boxless config → a pure random Latin square
    }

    const shapes = generateCalcCageShapes(size, { ...options, maxSize });
    const cages = assignCalcCages(shapes, solution, { activeOps, rng });
    if (!cages) continue; // un-cluable cage under this operator set — try again

    if (new CalcSolver(cages, size).countSolutions(2, options.verifyNodeBudget) === 1) {
      return { cages, solution, gridSize: size };
    }
  }

  throw new Error(`Could not generate a unique Keisan (${size}×${size}) layout in ${maxAttempts} attempts`);
}
