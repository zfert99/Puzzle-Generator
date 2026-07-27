// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateUniqueCalc,
  generateCalcCageShapes,
  calcGridConfig,
  assignCalcCages,
} from './calc-generator';
import { computeTarget, type CalcCage } from './calc-types';

/** Deterministic LCG in [0, 1) so tests are reproducible. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function isLatinSquare(grid: number[][], size: number): boolean {
  const expected = Array.from({ length: size }, (_, i) => i + 1).join(',');
  const sorted = (nums: number[]) => [...nums].sort((a, b) => a - b).join(',');
  for (let i = 0; i < size; i++) {
    if (sorted(grid[i]) !== expected) return false;
    if (sorted(grid.map((row) => row[i])) !== expected) return false;
  }
  return true;
}

function cagesPartitionGrid(cages: CalcCage[], size: number): boolean {
  const seen = new Array<number>(size * size).fill(0);
  for (const cage of cages) for (const cell of cage.cells) seen[cell] += 1;
  return seen.every((n) => n === 1);
}

function cagesSatisfied(cages: CalcCage[], grid: number[][], size: number): boolean {
  return cages.every((cage) => {
    const digits = cage.cells.map((cell) => grid[Math.floor(cell / size)][cell % size]);
    return computeTarget(cage.op, digits) === cage.target;
  });
}

/**
 * Independent brute-force solution counter: fill the grid cell-by-cell respecting ONLY the
 * Latin-square row/column rule, then accept a full grid iff every cage's digits hit its target.
 * Deliberately shares no logic with `CalcSolver`'s cage pruning, so it validates that solver.
 */
function bruteForceCount(cages: CalcCage[], size: number, cap = 2): number {
  const grid = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rowUsed = Array.from({ length: size }, () => new Set<number>());
  const colUsed = Array.from({ length: size }, () => new Set<number>());
  let count = 0;
  const recurse = (idx: number): void => {
    if (count >= cap) return;
    if (idx === size * size) {
      if (cagesSatisfied(cages, grid, size)) count += 1;
      return;
    }
    const r = Math.floor(idx / size);
    const c = idx % size;
    for (let d = 1; d <= size; d++) {
      if (rowUsed[r].has(d) || colUsed[c].has(d)) continue;
      grid[r][c] = d;
      rowUsed[r].add(d);
      colUsed[c].add(d);
      recurse(idx + 1);
      grid[r][c] = 0;
      rowUsed[r].delete(d);
      colUsed[c].delete(d);
      if (count >= cap) return;
    }
  };
  recurse(0);
  return count;
}

describe('calcGridConfig', () => {
  it('is always boxless, even at box-tileable sizes (Keisan is Latin-square-only)', () => {
    expect(calcGridConfig(4)).toMatchObject({ hasBoxes: false, boxWidth: 4, boxHeight: 1, maxNum: 4 });
    expect(calcGridConfig(6)).toMatchObject({ hasBoxes: false, boxWidth: 6, boxHeight: 1, maxNum: 6 });
  });
});

describe('generateCalcCageShapes', () => {
  it('partitions the grid and does not force every cage to maxSize (termination works)', () => {
    const shapes = generateCalcCageShapes(6, { minSize: 1, maxSize: 3, rng: seededRng(42) });
    const cells = shapes.flat();
    expect(cells.length).toBe(36);
    expect(new Set(cells).size).toBe(36); // every cell covered exactly once
    expect(Math.max(...shapes.map((s) => s.length))).toBeLessThanOrEqual(3);
    expect(shapes.some((s) => s.length < 3)).toBe(true); // not all ran to maxSize
  });
});

describe('assignCalcCages', () => {
  it('clues single-cell cages as givens and multi-cell cages with legal operators', () => {
    const solution = [
      [1, 2, 3, 4],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
      [4, 3, 2, 1],
    ];
    const shapes = [[0], [1, 2], [3, 7], [4, 5, 6], [8, 9], [10, 11], [12, 13], [14, 15]];
    const cages = assignCalcCages(shapes, solution, { activeOps: ['add', 'sub', 'mul', 'div'], rng: seededRng(7) });
    expect(cages).not.toBeNull();
    expect(cages![0]).toMatchObject({ op: 'add', target: 1, cells: [0] }); // given
    expect(cagesSatisfied(cages!, solution, 4)).toBe(true);
  });
});

describe('generateUniqueCalc', () => {
  it('produces a unique, well-formed 4×4 puzzle (Latin square, partition, cages satisfied)', () => {
    const { cages, solution, gridSize } = generateUniqueCalc(4, { rng: seededRng(123), maxSize: 3 });
    expect(gridSize).toBe(4);
    expect(isLatinSquare(solution, 4)).toBe(true);
    expect(cagesPartitionGrid(cages, 4)).toBe(true);
    expect(cagesSatisfied(cages, solution, 4)).toBe(true);
  });

  it('produces a unique 6×6 puzzle', () => {
    const { cages, solution } = generateUniqueCalc(6, { rng: seededRng(999), maxSize: 3 });
    expect(isLatinSquare(solution, 6)).toBe(true);
    expect(cagesPartitionGrid(cages, 6)).toBe(true);
    expect(cagesSatisfied(cages, solution, 6)).toBe(true);
  });

  it('fuzz: every generated 4×4 is genuinely unique per an independent brute force', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { cages } = generateUniqueCalc(4, { rng: seededRng(seed * 31), maxSize: 3 });
      expect(bruteForceCount(cages, 4, 2)).toBe(1); // exactly one solution — matches the solver
    }
  });

  it('throws when the operator set cannot clue the cage sizes present (legality invariant)', () => {
    expect(() => generateUniqueCalc(6, { activeOps: ['div'], maxSize: 3 })).toThrow(/needs 'add' or 'mul'/);
  });
});
