import { describe, expect, it } from 'vitest';
import { SKYSCRAPERS_FIXTURES, SKYSCRAPERS_FIXTURE_5X5, SKYSCRAPERS_FIXTURE_6X6, SKYSCRAPERS_FIXTURE_7X7 } from './skyscrapers-fixtures';
import {
  SkyscrapersLogicalSolver,
  TECHNIQUE_TIER,
  classifySkyscrapers,
  explainSkyscrapersHint,
  measureSkyscrapers,
  type SkyscrapersTechnique,
} from './skyscrapers-logical-solver';
import { countSkyscrapersSolutions } from './skyscrapers-solver';
import { GUTTER_SIDES, deriveClues, type SkyscraperClues } from './skyscrapers-types';

/** A random Latin square by backtracking with shuffled heights. */
function randomSquare(size: number): number[][] {
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const rowUsed = Array.from({ length: size }, () => new Set<number>());
  const colUsed = Array.from({ length: size }, () => new Set<number>());
  const fill = (k: number): boolean => {
    if (k === size * size) return true;
    const r = Math.floor(k / size);
    const c = k % size;
    const order = Array.from({ length: size }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    for (const h of order) {
      if (rowUsed[r].has(h) || colUsed[c].has(h)) continue;
      grid[r][c] = h;
      rowUsed[r].add(h);
      colUsed[c].add(h);
      if (fill(k + 1)) return true;
      rowUsed[r].delete(h);
      colUsed[c].delete(h);
    }
    grid[r][c] = 0;
    return false;
  };
  fill(0);
  return grid;
}

/** A random unique puzzle: a square with all clues, thinned while it stays unique. */
function randomUniquePuzzle(size: number): { solution: number[][]; clues: SkyscraperClues } | null {
  const solution = randomSquare(size);
  const clues = deriveClues(solution);
  if (countSkyscrapersSolutions({ gridSize: size, clues }).solutions !== 1) return null;
  const slots = GUTTER_SIDES.flatMap((side) => Array.from({ length: size }, (_, i) => [side, i] as const)).sort(() => Math.random() - 0.5);
  for (const [side, i] of slots) {
    const keep = clues[side][i];
    clues[side][i] = 0;
    if (countSkyscrapersSolutions({ gridSize: size, clues }).solutions !== 1) clues[side][i] = keep;
  }
  return { solution, clues };
}

const SQUARE = [
  [1, 2, 3, 4],
  [2, 1, 4, 3],
  [3, 4, 1, 2],
  [4, 3, 2, 1],
];
const blank = (n: number): SkyscraperClues => ({ top: Array(n).fill(0), bottom: Array(n).fill(0), left: Array(n).fill(0), right: Array(n).fill(0) });

describe('SkyscrapersLogicalSolver', () => {
  it('orders every technique by tier, so "first that fires" is the weakest that works', () => {
    const order: SkyscrapersTechnique[] = ['clueN', 'clue1', 'facingSum', 'positionBound', 'nearlyFilledClue', 'nakedSingle', 'hiddenSingle', 'clue2Pattern', 'reachability', 'lineFilter', 'nakedSubset', 'hiddenSubset', 'xWing', 'forcingChain'];
    for (let i = 1; i < order.length; i++) expect(TECHNIQUE_TIER[order[i]]).toBeGreaterThanOrEqual(TECHNIQUE_TIER[order[i - 1]]);
  });

  it('is sound on every baked fixture: every placement is the solution\'s, and the ladder finishes', () => {
    for (const puzzle of SKYSCRAPERS_FIXTURES) {
      const result = new SkyscrapersLogicalSolver(puzzle).solve({ recordSteps: true });
      expect(result.solved).toBe(true);
      expect(result.contradiction).toBe(false);
      for (const step of result.steps) {
        if (!step.placed) continue;
        const { cell, digit } = step.placed;
        expect(digit, `${step.technique}: ${step.explanation}`).toBe(puzzle.solution[Math.floor(cell / puzzle.gridSize)][cell % puzzle.gridSize]);
      }
    }
  });

  it('is sound on random uniquely-solvable puzzles — the classifier never contradicts the exact solver', () => {
    let checked = 0;
    for (let trial = 0; trial < 40 && checked < 25; trial++) {
      const size = 4 + Math.floor(Math.random() * 2);
      const puzzle = randomUniquePuzzle(size);
      if (!puzzle) continue;
      const result = new SkyscrapersLogicalSolver({ gridSize: size, clues: puzzle.clues }).solve({ recordSteps: true });
      expect(result.contradiction).toBe(false);
      for (const step of result.steps) {
        if (!step.placed) continue;
        expect(step.placed.digit, JSON.stringify(puzzle.clues)).toBe(puzzle.solution[Math.floor(step.placed.cell / size)][step.placed.cell % size]);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('fires each one-move clue rule on its minimal case', () => {
    // Clue N on a column: the heights climb; clue 1: the tallest next to it; facing 2 + 3 = 5: N two in.
    const clues = blank(4);
    clues.top[0] = 4;
    let step = new SkyscrapersLogicalSolver({ gridSize: 4, clues }).step();
    expect(step).toMatchObject({ technique: 'clueN', placed: { cell: 0, digit: 1 } });

    const c1 = blank(4);
    c1.left[2] = 1;
    step = new SkyscrapersLogicalSolver({ gridSize: 4, clues: c1 }).step();
    expect(step).toMatchObject({ technique: 'clue1', placed: { cell: 8, digit: 4 } });

    const sum = blank(4);
    sum.left[1] = 2;
    sum.right[1] = 3;
    step = new SkyscrapersLogicalSolver({ gridSize: 4, clues: sum }).step();
    expect(step).toMatchObject({ technique: 'facingSum', placed: { cell: 5, digit: 4 } });
    expect(step?.explanation).toMatch(/add up to 5/);
  });

  it('applies the position bound: under a clue of 3 the first cell cannot hold 3 or 4 (N = 4)', () => {
    const clues = blank(4);
    clues.top[1] = 3;
    const step = new SkyscrapersLogicalSolver({ gridSize: 4, clues }).step();
    expect(step?.technique).toBe('positionBound');
    // distance 0: max height 4 − 3 + 1 = 2 → 3 and 4 removed; distance 1: max 3 → 4 removed.
    expect(step?.eliminated).toContainEqual({ cell: 1, mask: (1 << 2) | (1 << 3) });
    expect(step?.eliminated).toContainEqual({ cell: 5, mask: 1 << 3 });
  });

  it('applies the clue-2 patterns: N − 1 never second; a 1 first forces N second', () => {
    const clues = blank(4);
    clues.left[0] = 2;
    const solver = new SkyscrapersLogicalSolver({ gridSize: 4, clues });
    const first = solver.step(2, new Set(['positionBound']));
    expect(first).toMatchObject({ technique: 'clue2Pattern', eliminated: [{ cell: 1, mask: 1 << 2 }] });

    const grid = [[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const placed = new SkyscrapersLogicalSolver({ gridSize: 4, clues }, grid).step(2, new Set(['positionBound', 'nearlyFilledClue', 'nakedSingle', 'hiddenSingle']));
    expect(placed).toMatchObject({ technique: 'clue2Pattern', placed: { cell: 1, digit: 4 } });
  });

  it('applies reachability: with 2 of 3 seen and the tallest still to come, the next cell cannot be mid-height', () => {
    const clues = blank(5);
    clues.left[0] = 3;
    const grid = [[2, 3, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
    const solver = new SkyscrapersLogicalSolver({ gridSize: 5, clues }, grid);
    const step = solver.step(2, new Set(['positionBound', 'nakedSingle', 'hiddenSingle', 'clue2Pattern']));
    // 4 would be seen (3rd) and then 5 (4th): impossible; 1 and 5 are fine.
    expect(step?.technique).toMatch(/nearlyFilledClue|reachability/);
    expect(step?.eliminated[0]).toMatchObject({ cell: 2, mask: 1 << 3 });
  });

  it('fires the Latin subsets and the X-wing on hand-built states, and nothing on an empty unclued board', () => {
    // Nothing to deduce: no clue rule, no single, no subset — every technique must stay quiet.
    expect(new SkyscrapersLogicalSolver({ gridSize: 4, clues: blank(4) }).step()).toBeNull();

    // Naked pair: columns 1 and 2 hold 3 and 4 below row 1, so (1,1) and (1,2) are {1,2} — no other
    // cell of row 1 may hold 1 or 2.
    const pairGrid = [[0, 0, 0, 0], [3, 4, 0, 0], [4, 3, 0, 0], [0, 0, 0, 0]];
    const pair = new SkyscrapersLogicalSolver({ gridSize: 4, clues: blank(4) }, pairGrid).step();
    expect(pair?.technique).toBe('nakedSubset');
    expect(pair?.eliminated).toEqual(expect.arrayContaining([{ cell: 2, mask: 0b11 }, { cell: 3, mask: 0b11 }]));

    // Hidden pair: 1 and 2 already stand in columns 3–5, so in row 1 they can only go in (1,1) and
    // (1,2) — those cells hold nothing else. (The naked triple {3,4,5} sees the same thing first;
    // it is disabled so the hidden form is the one under test.)
    const hiddenGrid = [[0, 0, 0, 0, 0], [0, 0, 1, 2, 0], [0, 0, 2, 0, 1], [0, 0, 0, 1, 2], [0, 0, 0, 0, 0]];
    const hidden = new SkyscrapersLogicalSolver({ gridSize: 5, clues: blank(5) }, hiddenGrid).step(3, new Set(['nakedSubset']));
    expect(hidden?.technique).toBe('hiddenSubset');
    expect(hidden?.eliminated).toEqual(expect.arrayContaining([{ cell: 0, mask: 0b11100 }, { cell: 1, mask: 0b11100 }]));

    // X-wing: in rows 1 and 2 the 5 can only stand in columns 1 and 2, so no other row may put its
    // 5 there.
    const wingGrid = [[0, 0, 1, 2, 3], [0, 0, 2, 3, 4], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
    const wing = new SkyscrapersLogicalSolver({ gridSize: 5, clues: blank(5) }, wingGrid).step();
    expect(wing?.technique).toBe('xWing');
    expect(wing?.eliminated).toHaveLength(6);
    expect(wing?.eliminated).toContainEqual({ cell: 10, mask: 1 << 4 });
    // One restricting row is not an X-wing.
    const oneRow = [[0, 0, 1, 2, 3], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
    expect(new SkyscrapersLogicalSolver({ gridSize: 5, clues: blank(5) }, oneRow).step()).toBeNull();
  });

  it('separates the tiers on the fixtures: the sparse 5×5 needs line filtering, the 6×6 and 7×7 need forcing chains', () => {
    expect(new SkyscrapersLogicalSolver(SKYSCRAPERS_FIXTURE_5X5).solve({ maxTier: 2 }).solved).toBe(false);
    expect(new SkyscrapersLogicalSolver(SKYSCRAPERS_FIXTURE_5X5).solve({ maxTier: 3 }).solved).toBe(true);
    expect(new SkyscrapersLogicalSolver(SKYSCRAPERS_FIXTURE_6X6).solve({ maxTier: 4 }).solved).toBe(false);
    expect(new SkyscrapersLogicalSolver(SKYSCRAPERS_FIXTURE_7X7).solve({ maxTier: 4 }).solved).toBe(false);
  });

  it('the Latin rules need no "required" guard here: a hidden single is sound on a full permutation (L1)', () => {
    // Row 0 of SQUARE with 1, 2, 3 placed: 4 has exactly one place — and it IS the solution's.
    const grid = [[1, 2, 3, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const step = new SkyscrapersLogicalSolver({ gridSize: 4, clues: blank(4) }, grid).step();
    expect(step).toMatchObject({ technique: 'nakedSingle', placed: { cell: 3, digit: 4 } });
    expect(SQUARE[0][3]).toBe(4);
  });

  it('reports a contradiction, never a guess, when the grid holds a wrong height', () => {
    const clues = deriveClues(SQUARE);
    const grid = SQUARE.map((row) => row.map(() => 0));
    grid[0][0] = 4; // under a top clue of 4
    const result = new SkyscrapersLogicalSolver({ gridSize: 4, clues }, grid).solve();
    expect(result.contradiction).toBe(true);
    expect(result.solved).toBe(false);
  });

  it('reports a contradiction for a complete line that breaks its clue', () => {
    const clues = deriveClues(SQUARE);
    const grid = [[2, 1, 3, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; // left clue 4 wants 1,2,3,4
    expect(new SkyscrapersLogicalSolver({ gridSize: 4, clues }, grid).solve().contradiction).toBe(true);
  });
});

describe('classifySkyscrapers', () => {
  it('grades the served fixtures: 5×5 hard, 6×6 extreme, 7×7 extreme — and every placement is sound', () => {
    expect(classifySkyscrapers(SKYSCRAPERS_FIXTURE_5X5)).toMatchObject({ tier: 3, difficulty: 'hard' });
    expect(classifySkyscrapers(SKYSCRAPERS_FIXTURE_6X6)).toMatchObject({ tier: 5, difficulty: 'extreme' });
    expect(classifySkyscrapers(SKYSCRAPERS_FIXTURE_7X7)).toMatchObject({ tier: 5, difficulty: 'extreme' });
    // The techniques the grades rest on (G7's first histogram): line filtering at 5×5, chains above.
    expect(classifySkyscrapers(SKYSCRAPERS_FIXTURE_5X5).result.techniqueCounts.lineFilter).toBeGreaterThan(0);
    expect(classifySkyscrapers(SKYSCRAPERS_FIXTURE_6X6).result.techniqueCounts.forcingChain).toBeGreaterThan(0);
    expect(classifySkyscrapers(SKYSCRAPERS_FIXTURE_7X7).result.techniqueCounts.forcingChain).toBeGreaterThan(0);
  });

  it('marks a puzzle the ladder cannot finish as unrated rather than guessing', () => {
    // A blank 4×4 has 576 solutions: no deduction can finish it.
    expect(classifySkyscrapers({ gridSize: 4, clues: blank(4) })).toMatchObject({ tier: null, difficulty: 'unrated' });
  });

  it('classifies the 7×7 well inside a second — the real timing (≈ 15 ms solo) is the plan\'s E2 gate, measured outside the suite', () => {
    // A unit test under the suite's parallel load measures the load, not the solver (pre-merge-log
    // lesson); the bound here only catches a pathological regression such as an unbounded chain.
    const start = performance.now();
    classifySkyscrapers(SKYSCRAPERS_FIXTURE_7X7);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('measureSkyscrapers', () => {
  it('reports the clue levers and what tiers 1–2 achieve', () => {
    const m = measureSkyscrapers(SKYSCRAPERS_FIXTURE_5X5);
    expect(m).toMatchObject({ size: 5, presentClues: 5, blankClues: 15, trivialClues: 1, facingSumPairs: 0 });
    expect(m.fixed).toBeGreaterThan(0);
    expect(m.implied).toBeGreaterThanOrEqual(m.fixed);
    expect(m.rating).toBeGreaterThan(1);
    const all = measureSkyscrapers({ gridSize: 4, clues: deriveClues(SQUARE) });
    expect(all.facingSumPairs).toBe(4); // rows 1 and 4 and columns 1 and 4 of that square (4+1)
  });
});

describe('explainSkyscrapersHint', () => {
  it('names the technique and the reason for the first placement from an empty grid', () => {
    const empty = SKYSCRAPERS_FIXTURE_5X5.solution.map((row) => row.map(() => 0));
    const hint = explainSkyscrapersHint(SKYSCRAPERS_FIXTURE_5X5, empty);
    expect(hint).not.toBeNull();
    expect(hint!.technique).toBe('clueN');
    expect(hint!.digit).toBe(SKYSCRAPERS_FIXTURE_5X5.solution[Math.floor(hint!.cell / 5)][hint!.cell % 5]);
    expect(hint!.explanation).toMatch(/every tower is visible/);
  });

  it('places the preferred cell when it is the next deduction, and never detours for it', () => {
    const grid = [[1, 2, 3, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const preferred = explainSkyscrapersHint({ gridSize: 4, clues: blank(4) }, grid, { preferCell: 3 });
    expect(preferred).toMatchObject({ cell: 3, digit: 4, technique: 'nakedSingle' });
    // A clue rule placing elsewhere is the hint instead (no silent detour — Kakuro L13).
    const clues = deriveClues(SQUARE); // top clue 4 on column 0 climbs 1..4
    const empty = SQUARE.map((row) => row.map(() => 0));
    expect(explainSkyscrapersHint({ gridSize: 4, clues }, empty, { preferCell: 8 })).toMatchObject({ cell: 0, digit: 1, technique: 'clueN' });
  });

  it('returns null for a contradictory grid', () => {
    const clues = deriveClues(SQUARE);
    const grid = SQUARE.map((row) => row.map(() => 0));
    grid[0][0] = 4;
    expect(explainSkyscrapersHint({ gridSize: 4, clues }, grid)).toBeNull();
  });
});
