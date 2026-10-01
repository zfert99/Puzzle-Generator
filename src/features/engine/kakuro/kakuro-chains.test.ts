import { describe, expect, it } from 'vitest';
import { findFirstChainElimination, findForcingChain, type ChainContext } from './kakuro-chains';
import { ALL_KAKURO_FIXTURES, KAKURO_FIXTURE_7X7_CHAINS, findKakuroFixture, parseKakuroFixture } from './kakuro-fixtures';
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
  it('eliminates a candidate whose supposition empties a variable, and says how', () => {
    // From the original 7×7's tier-3 standstill the first chain the ladder finds is a real
    // suppose-and-contradict argument; its explanation names the path and the dead end.
    const solver = new KakuroLogicalSolver(KAKURO_FIXTURE_7X7_CHAINS);
    solver.solve({ maxTier: 3 });
    const chain = findFirstChainElimination(solver.chainContext(), 4);

    expect(chain).not.toBeNull();
    expect(chain!.length).toBe(4);
    expect(chain!.digit).not.toBe(digitAt(KAKURO_FIXTURE_7X7_CHAINS, chain!.cell));
    expect(chain!.explanation).toMatch(/^If row \d, column \d were \d: .*, and then .* — so \d is impossible there \(chain of 4\)$/);
  });

  it('treats what is already forced as facts, not chain: a fact-excluded target is a chain of length 0', () => {
    // The 3×3 is solvable by facts alone (single-combination runs and singles cascade), so in a
    // raw 1–9 context every wrong digit is excluded before anything is supposed.
    const tiny = parseKakuroFixture(['#13', '124', '35#'], 'unrated');
    const chain = findForcingChain(contextFor(tiny), 1, 3, 8);
    expect(chain).toMatchObject({ cell: 1, digit: 3, length: 0 });
    expect(chain!.explanation).toContain('already forced');
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
    const ctx = solver.chainContext();
    expect(findFirstChainElimination(ctx, 3)).toBeNull();
    const found = findFirstChainElimination(ctx, 4);
    expect(found).not.toBeNull();
    expect(found!.length).toBe(4);
  });

  it('applies the length bound exactly: a chain of length L is found at bound L and not at L − 1', () => {
    // Take the first chain the extreme 7×7 needs at its tier-3 standstill, learn its length,
    // and probe the bound on either side of it — the off-by-one test for `chain.length >= max`.
    const extreme = findKakuroFixture(7, 'extreme')!;
    const solver = new KakuroLogicalSolver(extreme);
    solver.solve({ maxTier: 3 });
    const ctx = solver.chainContext();
    const found = findFirstChainElimination(ctx, 12)!;
    expect(found).not.toBeNull();
    const L = found.length;
    expect(L).toBeGreaterThan(0);
    expect(findForcingChain(ctx, found.cell, found.digit, L)?.length).toBe(L);
    expect(findForcingChain(ctx, found.cell, found.digit, L - 1)).toBeNull();
  });

  it('reports the run the contradiction surfaced in', () => {
    const solver = new KakuroLogicalSolver(KAKURO_FIXTURE_7X7_CHAINS);
    solver.solve({ maxTier: 3 });
    const ctx = solver.chainContext();
    const found = findFirstChainElimination(ctx, 4)!;
    expect(found.contradictionRun).toBeGreaterThanOrEqual(0);
    expect(found.explanation).toContain(ctx.runLabel(found.contradictionRun).split(' (')[0]);
  });

  it('never eliminates a solution digit, on every fixture, at every tier-3 standstill', () => {
    for (const puzzle of ALL_KAKURO_FIXTURES) {
      const solver = new KakuroLogicalSolver(puzzle);
      solver.solve({ maxTier: 3 });
      const ctx = solver.chainContext();
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
