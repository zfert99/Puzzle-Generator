import { describe, expect, it } from 'vitest';
import { generateKakuro, generateKakuroDetailed } from './kakuro';
import { isKakuroUnique } from './kakuro-solver';
import { validateKakuroRuns } from './kakuro-types';

describe('generateKakuro (E4: tier by bounded rejection)', () => {
  it('serves a hard 9×9 fresh — the common tier lands inside the budget', () => {
    const { puzzle, source } = generateKakuroDetailed('hard', { gridSize: 9 });
    expect(puzzle.difficulty).toBe('hard');
    expect(source).toBe('generated');
    expect(isKakuroUnique({ gridSize: 9, runs: puzzle.runs })).toBe(true);
    expect(validateKakuroRuns(puzzle.runs, puzzle.solution)).toEqual([]);
  }, 30_000);

  it('never serves a label the classifier did not assign: a budget of zero falls back honestly', () => {
    // 7×7 has a baked fixture per tier, so the fallback is the exact-tier fixture.
    const seven = generateKakuroDetailed('easy', { gridSize: 7, attempts: 0 });
    expect(seven.source).toBe('fixture');
    expect(seven.puzzle.difficulty).toBe('easy');
    // 6×6 has none, so the fallback is a generated puzzle carrying its real tier.
    const six = generateKakuroDetailed('easy', { gridSize: 6, attempts: 0 });
    expect(six.source).toBe('nearest');
    expect(six.puzzle.gridSize).toBe(6);
    expect(['easy', 'medium', 'hard', 'expert', 'extreme', 'unrated']).toContain(six.puzzle.difficulty);
  }, 30_000);

  it('defaults to 7×7 and returns a playable puzzle', () => {
    const puzzle = generateKakuro('hard');
    expect(puzzle.gridSize).toBe(7);
    expect(puzzle.grid.flat().every((d) => d === 0)).toBe(true);
  }, 30_000);
});
