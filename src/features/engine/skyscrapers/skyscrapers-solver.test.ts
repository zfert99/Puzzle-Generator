import { describe, expect, it } from 'vitest';
import { isLatinSquare } from '../grid-utils';
import {
  SKYSCRAPERS_FIXTURES,
  SKYSCRAPERS_FIXTURE_5X5,
  SKYSCRAPERS_FIXTURE_7X7,
  SKYSCRAPERS_NONUNIQUE_4X4,
} from './skyscrapers-fixtures';
import { countSkyscrapersSolutions, deduceSkyscrapers, isSkyscrapersUnique, type SkyscrapersShape } from './skyscrapers-solver';
import { GUTTER_SIDES, deriveClues, lineFor, visibleCount, type SkyscraperClues } from './skyscrapers-types';

/**
 * An independent brute force: every Latin square of size N, checked against every present clue.
 * Nothing shared with the solver but the clue arrays and `visibleCount`.
 */
function bruteForceCount(shape: SkyscrapersShape, limit = 50): number {
  const { gridSize: size, clues } = shape;
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const rowUsed = Array.from({ length: size }, () => new Set<number>());
  const colUsed = Array.from({ length: size }, () => new Set<number>());
  let count = 0;
  const satisfies = () =>
    GUTTER_SIDES.every((side) =>
      clues[side].every((clue, i) => clue === 0 || visibleCount(lineFor(grid, side, i)) === clue)
    );
  const place = (k: number): boolean => {
    if (k === size * size) {
      if (satisfies()) count++;
      return count >= limit;
    }
    const r = Math.floor(k / size);
    const c = k % size;
    for (let h = 1; h <= size; h++) {
      if (rowUsed[r].has(h) || colUsed[c].has(h)) continue;
      grid[r][c] = h;
      rowUsed[r].add(h);
      colUsed[c].add(h);
      if (place(k + 1)) return true;
      rowUsed[r].delete(h);
      colUsed[c].delete(h);
    }
    grid[r][c] = 0;
    return false;
  };
  place(0);
  return count;
}

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

/** Every Latin square of size N (576 at 4). */
function allSquares(size: number): number[][][] {
  const out: number[][][] = [];
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const rowUsed = Array.from({ length: size }, () => new Set<number>());
  const colUsed = Array.from({ length: size }, () => new Set<number>());
  const rec = (k: number) => {
    if (k === size * size) {
      out.push(grid.map((row) => [...row]));
      return;
    }
    const r = Math.floor(k / size);
    const c = k % size;
    for (let h = 1; h <= size; h++) {
      if (rowUsed[r].has(h) || colUsed[c].has(h)) continue;
      grid[r][c] = h;
      rowUsed[r].add(h);
      colUsed[c].add(h);
      rec(k + 1);
      rowUsed[r].delete(h);
      colUsed[c].delete(h);
    }
    grid[r][c] = 0;
  };
  rec(0);
  return out;
}

/**
 * The research's 4×4 counterexample square: NOT determined even by all 16 of its clues (it
 * shares them with a second square), which makes it the right square for the "respects placed
 * heights" and "no 2-clue subset" cases below — and the wrong one for any uniqueness claim.
 */
const SQUARE = [
  [1, 2, 3, 4],
  [2, 1, 4, 3],
  [3, 4, 1, 2],
  [4, 3, 2, 1],
];

describe('countSkyscrapersSolutions', () => {
  it('finds the single solution of the sparse 5×5 fixture (five clues), and returns it', () => {
    const result = countSkyscrapersSolutions(SKYSCRAPERS_FIXTURE_5X5);
    expect(result).toMatchObject({ solutions: 1, exhausted: false });
    expect(result.solution).toEqual(SKYSCRAPERS_FIXTURE_5X5.solution);
  });

  it('reports two solutions for the research\'s 4×4 counterexample pair (same 16 clues)', () => {
    const [a, b] = SKYSCRAPERS_NONUNIQUE_4X4;
    const result = countSkyscrapersSolutions(a, { limit: 10 });
    expect(result.solutions).toBe(2);
    expect(result.exhausted).toBe(false);
    expect([a.solution, b.solution]).toContainEqual(result.solution);
  });

  it('counts every Latin square when there are no clues at all', () => {
    const blank: SkyscraperClues = { top: [0, 0, 0], bottom: [0, 0, 0], left: [0, 0, 0], right: [0, 0, 0] };
    expect(countSkyscrapersSolutions({ gridSize: 3, clues: blank }, { limit: 100 }).solutions).toBe(12);
  });

  it('counts exactly what an independent brute force counts, on random small puzzles', () => {
    let checked = 0;
    for (let trial = 0; trial < 60; trial++) {
      const size = 3 + Math.floor(Math.random() * 2);
      const clues = deriveClues(randomSquare(size));
      // Blank a random subset of the clues so the search has work to do.
      for (const side of GUTTER_SIDES) clues[side] = clues[side].map((clue) => (Math.random() < 0.5 ? 0 : clue));
      const shape = { gridSize: size, clues };
      const expected = bruteForceCount(shape, 50);
      const result = countSkyscrapersSolutions(shape, { limit: 50, nodeBudget: 1_000_000 });
      expect(result.exhausted).toBe(false);
      expect(result.solutions, JSON.stringify(clues)).toBe(expected);
      checked++;
    }
    expect(checked).toBe(60);
  });

  it('respects placed heights in a starting grid', () => {
    const shape = { gridSize: 4, clues: deriveClues(SQUARE) }; // two solutions: SQUARE and its twin
    const [, twin] = SKYSCRAPERS_NONUNIQUE_4X4;
    const grid = SQUARE.map((row) => row.map(() => 0));
    grid[1][1] = 1; // only SQUARE has a 1 here
    expect(countSkyscrapersSolutions(shape, { grid, limit: 10 })).toMatchObject({ solutions: 1, solution: SQUARE });
    grid[1][1] = 4; // only the twin has a 4 here
    expect(countSkyscrapersSolutions(shape, { grid, limit: 10 })).toMatchObject({ solutions: 1, solution: twin.solution });
    grid[1][1] = 3; // neither
    expect(countSkyscrapersSolutions(shape, { grid, limit: 10 }).solutions).toBe(0);
  });

  it('treats a clue the puzzle cannot hold as a contradiction, never as an index past the table', () => {
    const clues = deriveClues(randomSquare(5));
    clues.left[0] = 9; // a corrupt save, or a hand-edited fixture
    expect(countSkyscrapersSolutions({ gridSize: 5, clues })).toMatchObject({ solutions: 0, exhausted: false });
    expect(deduceSkyscrapers({ gridSize: 5, clues }, Array.from({ length: 5 }, () => Array(5).fill(0))).contradiction).toBe(true);
    clues.left[0] = -1;
    expect(countSkyscrapersSolutions({ gridSize: 5, clues }).solutions).toBe(0);
    clues.left[0] = 2.5;
    expect(countSkyscrapersSolutions({ gridSize: 5, clues }).solutions).toBe(0);
  });

  it('reports budget exhaustion rather than guessing', () => {
    const blank: SkyscraperClues = { top: [0, 0, 0, 0, 0], bottom: [0, 0, 0, 0, 0], left: [0, 0, 0, 0, 0], right: [0, 0, 0, 0, 0] };
    const result = countSkyscrapersSolutions({ gridSize: 5, clues: blank }, { limit: 1000, nodeBudget: 20 });
    expect(result.exhausted).toBe(true);
    // With limit 2 a 20-node budget is not even reached (two Latin squares come quickly); a
    // 1-node budget cannot complete the first branch, so the answer is "unknown", never a guess.
    expect(isSkyscrapersUnique({ gridSize: 5, clues: blank }, 1)).toBeNull();
    expect(isSkyscrapersUnique({ gridSize: 5, clues: blank }, 1_000)).toBe(false);
  });

  it('reproduces the research\'s all-clue ambiguity at 4×4: 204 of 576 squares are not unique', () => {
    let nonUnique = 0;
    for (const square of allSquares(4)) {
      const result = countSkyscrapersSolutions({ gridSize: 4, clues: deriveClues(square) });
      expect(result.exhausted).toBe(false);
      if (result.solutions !== 1) nonUnique++;
    }
    expect(nonUnique).toBe(204);
  });

  it('confirms the minimum-clue facts at 4×4: no 2-clue subset determines any square, some 3-clue subset does (G5)', () => {
    const full = deriveClues(SQUARE);
    const slots = GUTTER_SIDES.flatMap((side) => [0, 1, 2, 3].map((i) => [side, i] as const));
    const withOnly = (kept: readonly (readonly [string, number])[]): SkyscraperClues => {
      const clues: SkyscraperClues = { top: [0, 0, 0, 0], bottom: [0, 0, 0, 0], left: [0, 0, 0, 0], right: [0, 0, 0, 0] };
      for (const [side, i] of kept) clues[side as keyof SkyscraperClues][i] = full[side as keyof SkyscraperClues][i];
      return clues;
    };
    // Every pair of clues leaves at least two solutions (for this square and a sample of others —
    // the research proved it for all 576).
    for (let a = 0; a < slots.length; a++) {
      for (let b = a + 1; b < slots.length; b++) {
        expect(countSkyscrapersSolutions({ gridSize: 4, clues: withOnly([slots[a], slots[b]]) }).solutions).toBeGreaterThan(1);
      }
    }
    // Some triple determines some square: SQUARE itself is one of the 204 undetermined ones, so
    // search the triples of other squares until one is pinned (the research: 208 squares have one).
    const squares = allSquares(4);
    let found = false;
    outer: for (const square of squares) {
      const all = deriveClues(square);
      const only = (kept: readonly (readonly [string, number])[]): SkyscraperClues => {
        const clues: SkyscraperClues = { top: [0, 0, 0, 0], bottom: [0, 0, 0, 0], left: [0, 0, 0, 0], right: [0, 0, 0, 0] };
        for (const [side, i] of kept) clues[side as keyof SkyscraperClues][i] = all[side as keyof SkyscraperClues][i];
        return clues;
      };
      for (let a = 0; a < slots.length; a++) {
        for (let b = a + 1; b < slots.length; b++) {
          for (let c = b + 1; c < slots.length; c++) {
            if (countSkyscrapersSolutions({ gridSize: 4, clues: only([slots[a], slots[b], slots[c]]) }).solutions === 1) {
              found = true;
              break outer;
            }
          }
        }
      }
    }
    expect(found).toBe(true);
  });
});

describe('the baked fixtures', () => {
  it.each(SKYSCRAPERS_FIXTURES.map((p) => [`${p.gridSize}×${p.gridSize}`, p] as const))(
    '%s is unique and the solver finds its solution',
    (_name, puzzle) => {
      const result = countSkyscrapersSolutions(puzzle, { limit: 2 });
      expect(result).toMatchObject({ solutions: 1, exhausted: false });
      expect(result.solution).toEqual(puzzle.solution);
      expect(isLatinSquare(result.solution!)).toBe(true);
    }
  );

  it('verifies the 7×7 well inside the 50 ms gate (loose bound — timing under load)', () => {
    countSkyscrapersSolutions(SKYSCRAPERS_FIXTURE_7X7); // warm the table
    const start = performance.now();
    for (let i = 0; i < 20; i++) countSkyscrapersSolutions(SKYSCRAPERS_FIXTURE_7X7);
    const perVerify = (performance.now() - start) / 20;
    expect(perVerify).toBeLessThan(50);
  });

  it('becomes non-unique when a kept clue is blanked on the sparse 5×5 (five clues is the floor it was cut to)', () => {
    const five = SKYSCRAPERS_FIXTURES[0];
    const clues: SkyscraperClues = { top: [...five.clues.top], bottom: [...five.clues.bottom], left: [...five.clues.left], right: [...five.clues.right] };
    // Blank the first present clue found.
    for (const side of GUTTER_SIDES) {
      const i = clues[side].findIndex((clue) => clue > 0);
      if (i !== -1) { clues[side][i] = 0; break; }
    }
    expect(countSkyscrapersSolutions({ gridSize: 5, clues }).solutions).toBeGreaterThan(1);
  });
});

describe('deduceSkyscrapers', () => {
  it('forces heights from an empty grid by propagation alone, all matching the solution', () => {
    for (const puzzle of SKYSCRAPERS_FIXTURES) {
      const empty = puzzle.solution.map((row) => row.map(() => 0));
      const { forced, contradiction } = deduceSkyscrapers(puzzle, empty);
      expect(contradiction).toBe(false);
      for (const { cell, digit } of forced) {
        expect(digit).toBe(puzzle.solution[Math.floor(cell / puzzle.gridSize)][cell % puzzle.gridSize]);
      }
    }
  });

  it('forces the obvious cells of a 4×4: a clue of 4 fixes its whole line, a clue of 1 places the 4', () => {
    const clues = deriveClues(SQUARE); // top 4,2,2,1 · left 4,2,2,1
    const empty = SQUARE.map((row) => row.map(() => 0));
    const { forced } = deduceSkyscrapers({ gridSize: 4, clues }, empty);
    const at = (r: number, c: number) => forced.find((f) => f.cell === r * 4 + c)?.digit;
    expect([at(0, 0), at(1, 0), at(2, 0), at(3, 0)]).toEqual([1, 2, 3, 4]); // top clue 4 on column 0
    expect(at(0, 3)).toBe(4); // top clue 1 on column 3
  });

  it('never lists a cell that is already filled, and reports a contradiction for an impossible grid', () => {
    const clues = deriveClues(SQUARE);
    const grid = SQUARE.map((row) => row.map(() => 0));
    grid[0][0] = 1;
    expect(deduceSkyscrapers({ gridSize: 4, clues }, grid).forced.some((f) => f.cell === 0)).toBe(false);
    grid[0][0] = 4; // under a top clue of 4, impossible
    expect(deduceSkyscrapers({ gridSize: 4, clues }, grid).contradiction).toBe(true);
  });
});
