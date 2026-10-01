import { describe, expect, it } from 'vitest';
import { generateKakuro, generateKakuroDetailed } from './kakuro';
import { classifyKakuro } from './kakuro-logical-solver';
import { isKakuroUnique } from './kakuro-solver';
import { validateKakuroRuns } from './kakuro-types';

describe('generateKakuro (E4: tier by bounded rejection)', () => {
  it('serves a hard 9×9 labelled by the classifier — fresh when the budget allows, the fixture otherwise', () => {
    // Rejection sampling is probabilistic and wall-clock bounded, so the *source* is not
    // asserted (a loaded runner may exhaust the budget); what is asserted holds either way: the
    // label is the requested tier AND the classifier's, and the puzzle is legal and unique.
    const { puzzle, source } = generateKakuroDetailed('hard', { gridSize: 9 });
    expect(puzzle.difficulty).toBe('hard');
    expect(['generated', 'fixture']).toContain(source);
    expect(classifyKakuro({ gridSize: 9, runs: puzzle.runs }).difficulty).toBe('hard');
    expect(isKakuroUnique({ gridSize: 9, runs: puzzle.runs })).toBe(true);
    expect(validateKakuroRuns(puzzle.runs, puzzle.solution)).toEqual([]);
  }, 30_000);

  it('keeps to its clock: a 300 ms budget is not overrun by a single attempt', () => {
    const started = performance.now();
    generateKakuroDetailed('easy', { gridSize: 9, timeBudgetMs: 300 });
    // Budget + the fixture fallback (no second budget at 9×9, which has fixtures) + slack.
    expect(performance.now() - started).toBeLessThan(1_500);
  });

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
