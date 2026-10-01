import { describe, expect, it } from 'vitest';
import { findFirstChainElimination, findForcingChain, type ChainContext } from './kakuro-chains';
import { ALL_KAKURO_FIXTURES, KAKURO_FIXTURE_7X7_CHAINS, parseKakuroFixture } from './kakuro-fixtures';
import { runComboMasks } from './kakuro-combinations';
import { KakuroLogicalSolver } from './kakuro-logical-solver';
import type { KakuroPuzzle } from './kakuro-types';

/**
 * A chain context straight from a puzzle and a candidate grid: every unplaced cell holds the
 * given masks (or 1–9), every run its open combinations. The logical solver builds the same
 * thing from its own state; this one lets a test hand the engine an exact situation.
 */
function contextFor(puzzle: KakuroPuzzle, masks?: Record<number, number>): ChainContext {
  const { gridSize: size, runs } = puzzle;
  const cellCount = size * size;
  const cellRuns = new Int32Array(cellCount * 2).fill(-1);
  runs.forEach((run, index) => {
    for (const cell of run.cells) cellRuns[cell * 2 + (run.dir === 'across' ? 0 : 1)] = index;
  });
  const maskArray = new Int32Array(cellCount);
  for (const run of runs) for (const cell of run.cells) maskArray[cell] = masks?.[cell] ?? 0b111111111;
  return {
    size,
    runs,
    masks: maskArray,
    placed: new Uint8Array(cellCount),
    cellRuns,
    openCombos: (r) => runComboMasks(runs[r].cells.length, runs[r].sum),
    runLabel: (r) => `${runs[r].sum}-in-${runs[r].cells.length} ${runs[r].dir} #${r}`,
    cellText: (cell) => `r${Math.floor(cell / size) + 1}c${(cell % size) + 1}`,
  };
}

const digitAt = (puzzle: KakuroPuzzle, cell: number) => puzzle.solution[Math.floor(cell / puzzle.gridSize)][cell % puzzle.gridSize];

describe('findForcingChain', () => {
  it('eliminates a candidate whose supposition empties a cell, and says how', () => {
    // 3×3: supposing 3 at (0,1) forces the top across run 4-in-two to {1,3} → (0,2) = 1, while
    // the right down run 7-in-two needs {1,6},{2,5},{3,4}: (0,2) = 1 forces (1,2) = 6, but the
    // middle across run 7-in-three {1,2,4} cannot hold a 6 → contradiction.
    const tiny = parseKakuroFixture(['#13', '124', '35#'], 'unrated');
    const chain = findForcingChain(contextFor(tiny), 1, 3, 8);

    expect(chain).not.toBeNull();
    expect(chain!.cell).toBe(1);
    expect(chain!.digit).toBe(3);
    expect(chain!.length).toBeGreaterThan(0);
    expect(chain!.explanation).toMatch(/^If r1c2 were 3: .* — so 3 is impossible there \(chain of \d+\)$/);
  });

  it('returns null when the supposition is the truth (no contradiction can follow)', () => {
    const tiny = parseKakuroFixture(['#13', '124', '35#'], 'unrated');
    expect(findForcingChain(contextFor(tiny), 1, 1, 12)).toBeNull(); // (0,1) really is 1
  });

  it('respects the length bound: a contradiction that needs more forced truths is not found', () => {
    const empty = KAKURO_FIXTURE_7X7_CHAINS.solution.map((row) => row.map(() => 0));
    // Run the ladder to its tier-3 standstill, then ask for chains at increasing bounds.
    const solver = new KakuroLogicalSolver(KAKURO_FIXTURE_7X7_CHAINS, empty);
    solver.solve({ maxTier: 3 });
    const ctx = (solver as unknown as { chainContext: () => ChainContext }).chainContext();
    expect(findFirstChainElimination(ctx, 3)).toBeNull();
    const found = findFirstChainElimination(ctx, 4);
    expect(found).not.toBeNull();
    expect(found!.length).toBe(4);
  });

  it('never eliminates a solution digit, on every fixture, at every tier-3 standstill', () => {
    for (const puzzle of ALL_KAKURO_FIXTURES) {
      const solver = new KakuroLogicalSolver(puzzle);
      solver.solve({ maxTier: 3 });
      const ctx = (solver as unknown as { chainContext: () => ChainContext }).chainContext();
      const cellCount = puzzle.gridSize * puzzle.gridSize;
      for (let cell = 0; cell < cellCount; cell++) {
        if (ctx.placed[cell] || ctx.masks[cell] === 0) continue;
        const truth = digitAt(puzzle, cell);
        if ((ctx.masks[cell] & (1 << (truth - 1))) === 0) continue; // not a white cell
        expect(findForcingChain(ctx, cell, truth, 12), `${puzzle.gridSize}×${puzzle.gridSize} ${puzzle.difficulty} cell ${cell}`).toBeNull();
      }
    }
  });
});
