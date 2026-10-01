import { describe, expect, it } from 'vitest';
import { findFirstChainElimination, findForcingChain, prepareChainWorkspace, type ChainContext, type ForcingChain } from './kakuro-chains';
import { ALL_KAKURO_FIXTURES, KAKURO_FIXTURE_7X7_CHAINS, KAKURO_FIXTURE_9X9_CHAINS, findKakuroFixture, parseKakuroFixture } from './kakuro-fixtures';
import { runComboMasks } from './kakuro-combinations';
import { KakuroLogicalSolver } from './kakuro-logical-solver';
import type { KakuroPuzzle, Run } from './kakuro-types';

/**
 * A chain context straight from a puzzle and a candidate grid: every unplaced cell holds the
 * given masks (or 1–9), every run its open combinations. The logical solver builds the same
 * thing from its own state; this one lets a test hand the engine an exact situation.
 */
function contextFor(puzzle: KakuroPuzzle, masks?: Record<number, number>): ChainContext {
  return contextOf(puzzle.gridSize, puzzle.runs, masks);
}

/** The same from bare runs — for situations no valid puzzle would produce. */
function contextOf(size: number, runs: readonly Run[], masks?: Record<number, number>): ChainContext {
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

/** The contradiction clause of a chain's explanation — what comes after the path, before the verdict. */
const contradictionText = (chain: ForcingChain) => chain.explanation.split(/, and then |: /).at(-1)!.split(' — so ')[0];

/** Every chain (≤ 12) provable from a fixture's tier-3 standstill, with the context it was found in. */
function chainsAtStandstill(puzzle: KakuroPuzzle): { ctx: ChainContext; chains: ForcingChain[] } {
  const solver = new KakuroLogicalSolver(puzzle);
  solver.solve({ maxTier: 3 });
  const ctx = solver.chainContext();
  const workspace = prepareChainWorkspace(ctx);
  const chains: ForcingChain[] = [];
  for (let cell = 0; cell < puzzle.gridSize * puzzle.gridSize; cell++) {
    if (ctx.placed[cell] || ctx.masks[cell] === 0) continue;
    for (let digit = 1; digit <= 9; digit++) {
      if ((ctx.masks[cell] & (1 << (digit - 1))) === 0) continue;
      const chain = findForcingChain(ctx, cell, digit, 12, workspace);
      if (chain) chains.push(chain);
    }
  }
  return { ctx, chains };
}

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
    // Run the ladder to its tier-3 standstill, then ask for chains at increasing bounds: the
    // shortest chain any target needs is found at its own length and at nothing shorter.
    const solver = new KakuroLogicalSolver(KAKURO_FIXTURE_7X7_CHAINS, empty);
    solver.solve({ maxTier: 3 });
    const ctx = solver.chainContext();
    let shortest = 0;
    while (shortest < 12 && !findFirstChainElimination(ctx, shortest)) shortest++;
    expect(shortest).toBeGreaterThan(1);
    expect(findFirstChainElimination(ctx, shortest)!.length).toBe(shortest); // found at its own length, not under it
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

  it('reports the run the contradiction surfaced in — the run that emptied, or the emptied cell\'s own run', () => {
    // Both kinds, found rather than hand-picked so a re-baked fixture keeps the test honest.
    const { ctx, chains } = chainsAtStandstill(KAKURO_FIXTURE_9X9_CHAINS);
    const runEmptied = chains.find((c) => /has no combination left|needs a \d/.test(contradictionText(c)));
    const cellEmptied = chains.find((c) => /has no digit left/.test(contradictionText(c)));
    expect(runEmptied).toBeDefined();
    expect(cellEmptied).toBeDefined();
    expect(contradictionText(runEmptied!)).toContain(ctx.runLabel(runEmptied!.contradictionRun));
    const cellText = contradictionText(cellEmptied!).replace(' has no digit left', '');
    const cell = Array.from({ length: 81 }, (_, i) => i).find((i) => ctx.cellText(i) === cellText)!;
    expect([ctx.cellRuns[cell * 2], ctx.cellRuns[cell * 2 + 1]]).toContain(cellEmptied!.contradictionRun);
  });

  it('g-link, contrapositive: a combination needing a digit no cell can hold is false', () => {
    // One run, 16-in-three, whose cells can hold only {6,7}, {8,9}, {6,7,8,9}: every combination
    // of 16 needs a 1, 2, 3, 4 or 5 that no cell can take, so the run has no combination left
    // before anything is supposed. The binary links alone never notice (eight combinations
    // stay "open"); the g-link empties the run in the facts pass.
    const ctx = contextOf(2, [{ id: 0, dir: 'across', sum: 16, cells: [0, 1, 2] }], { 0: 0b1100000, 1: 0b110000000, 2: 0b111100000 });
    expect(prepareChainWorkspace(ctx).inconsistent).toBe(true);
  });

  it('g-link, forward: a digit every open combination needs with one holder is forced there', () => {
    // Same run with cell 0 ∈ {1,6,7}: the open combinations are {1,6,9} and {1,7,8}, both need a
    // 1, and only cell 0 can hold it — so the facts place it, and a target the placement excludes
    // is a chain of length 0.
    const ctx = contextOf(2, [{ id: 0, dir: 'across', sum: 16, cells: [0, 1, 2] }], { 0: 0b1100001, 1: 0b110000000, 2: 0b111100000 });
    const workspace = prepareChainWorkspace(ctx);
    expect(workspace.inconsistent).toBe(false);
    expect(workspace.trueDigit[0]).toBe(1);
    expect(findForcingChain(ctx, 0, 6, 12, workspace)).toMatchObject({ length: 0 });
    expect(findForcingChain(ctx, 1, 9, 12, workspace)).toBeNull(); // {1,6,9} is consistent
  });

  it('the full g-link shortens the original 7×7: a chain of 3 where the one-way link needed 4', () => {
    // Pins the measured effect of applying the g-link in both directions (review follow-up 4):
    // the tier-4 bound was set from this fixture needing exactly 4.
    const solver = new KakuroLogicalSolver(KAKURO_FIXTURE_7X7_CHAINS);
    solver.solve({ maxTier: 3 });
    const ctx = solver.chainContext();
    expect(findFirstChainElimination(ctx, 2)).toBeNull();
    expect(findFirstChainElimination(ctx, 3)?.length).toBe(3);
  });

  it('an inconsistent context proves nothing: every target is null', () => {
    // Facts alone contradict: a cell left with no candidate under the masks.
    const puzzle = parseKakuroFixture(['#13', '124', '35#'], 'unrated');
    const ctx = contextFor(puzzle, { 1: 0b100, 2: 0b100 }); // both cells of 4-in-two across claim 3
    const workspace = prepareChainWorkspace(ctx);
    expect(workspace.inconsistent).toBe(true);
    expect(findForcingChain(ctx, 4, 2, 12, workspace)).toBeNull();
    expect(findFirstChainElimination(ctx, 12)).toBeNull();
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
