// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { countSolutions, digExhaustively } from './diggers';
import { copyGrid, createEmptyGrid, fillGrid, shuffle } from './grid-utils';
import { HumanSolver } from './human-solver';
import { generateSudoku, getGridConfig, isSudokuBudgetError, type GridConfig } from './sudoku';

/** Seeded PRNG (mulberry32) so every generation below is replayable. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The dig pass as it was before the uniqueness gate: HumanSolver alone decides every removal. */
function digWithoutGate(grid: number[][], config: GridConfig, rng: () => number, maxTier: 'advanced' | 'extreme'): void {
  const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i), rng);
  for (const pos of positions) {
    const row = Math.floor(pos / config.size);
    const col = pos % config.size;
    const backup = grid[row][col];
    if (backup === 0) continue;
    grid[row][col] = 0;
    if (!new HumanSolver(copyGrid(grid)).solve({ maxTier }).solved) grid[row][col] = backup;
  }
}

describe('countSolutions', () => {
  it('reports exactly one solution for a complete, valid grid', () => {
    const config = getGridConfig(9);
    const solved = createEmptyGrid(9);
    fillGrid(solved, config);
    expect(countSolutions(solved, config)).toBe(1);
  });

  it('detects multiple solutions for an under-constrained grid (capped at the limit)', () => {
    const config = getGridConfig(4);
    // A completely empty 4x4 grid has many solutions; countSolutions stops at the limit.
    expect(countSolutions(createEmptyGrid(4), config, 2)).toBe(2);
  });

  it('confirms a generated puzzle has a unique solution', () => {
    const config = getGridConfig(9);
    const puzzle = generateSudoku('easy', 9);
    expect(countSolutions(puzzle.grid, config)).toBe(1);
  });

  it('does not mutate the caller grid', () => {
    const config = getGridConfig(9);
    const puzzle = generateSudoku('easy', 9);
    const before = JSON.stringify(puzzle.grid);
    countSolutions(puzzle.grid, config);
    expect(JSON.stringify(puzzle.grid)).toBe(before);
  });
});

describe('digExhaustively (uniqueness gate)', () => {
  // The gate only skips HumanSolver runs that could never succeed (a sound solver cannot finish a
  // non-unique grid) and consumes no rng, so the dug puzzle must be byte-identical to the ungated
  // pass for the same seed.
  it.each([1, 2, 3])('digs the same advanced-tier puzzle as the ungated pass (seed %i)', (seed) => {
    const config = getGridConfig(9);
    const solution = createEmptyGrid(9);
    fillGrid(solution, config, mulberry32(seed));

    const gated = copyGrid(solution);
    digExhaustively(gated, config, mulberry32(seed * 7919), 'advanced');
    const ungated = copyGrid(solution);
    digWithoutGate(ungated, config, mulberry32(seed * 7919), 'advanced');

    expect(gated).toEqual(ungated);
  });

  it('digs the same extreme-tier puzzle as the ungated pass', () => {
    const config = getGridConfig(9);
    const solution = createEmptyGrid(9);
    fillGrid(solution, config, mulberry32(42));

    const gated = copyGrid(solution);
    digExhaustively(gated, config, mulberry32(4242), 'extreme');
    const ungated = copyGrid(solution);
    digWithoutGate(ungated, config, mulberry32(4242), 'extreme');

    expect(gated).toEqual(ungated);
  }, 60_000);
});

describe('Expert generation (applyExhaustiveDigger)', () => {
  it('is deterministic for a seeded rng', () => {
    expect(generateSudoku('expert', 9, mulberry32(11))).toEqual(generateSudoku('expert', 9, mulberry32(11)));
  });

  // The old digger only capped the solver at the advanced tier; ~90% of its "Expert" puzzles were
  // basic-solvable. The tier must now be REQUIRED, so the basic tier alone has to stall.
  it.each([1, 2, 3, 4, 5, 6])('needs an advanced strategy — basic alone cannot solve it (seed %i)', (seed) => {
    const puzzle = generateSudoku('expert', 9, mulberry32(seed));

    expect(new HumanSolver(puzzle.grid).solve({ maxTier: 'basic' }).solved).toBe(false);
    const advanced = new HumanSolver(puzzle.grid);
    expect(advanced.solve({ maxTier: 'advanced' })).toMatchObject({ solved: true, requiresAdvanced: true });
    expect(advanced.grid).toEqual(puzzle.solution);
  }, 30_000);
});

describe('timeBudgetMs', () => {
  it('throws the typed budget error when an Extreme generation outlives its budget', () => {
    let caught: unknown;
    try {
      generateSudoku('extreme', 9, mulberry32(3), { timeBudgetMs: 1 });
    } catch (error) {
      caught = error;
    }
    expect(isSudokuBudgetError(caught)).toBe(true);
  });

  it('is ignored by the quota diggers, which cannot run long', () => {
    expect(generateSudoku('easy', 9, mulberry32(3), { timeBudgetMs: 0 }).grid).toHaveLength(9);
  });
});
