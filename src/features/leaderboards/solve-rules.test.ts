import { describe, expect, it } from 'vitest';
import type { Grid } from '@/lib/db/schema';
import { gridsMatch, isImplausiblyFast, MIN_SOLVE_MS } from './solve-rules';

const solved: Grid = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
);

describe('gridsMatch', () => {
  it('true for identical grids', () => {
    expect(gridsMatch(solved, solved.map((row) => [...row]))).toBe(true);
  });

  it('false when a single cell differs', () => {
    const off = solved.map((row) => [...row]);
    off[4][4] = off[4][4] === 9 ? 1 : off[4][4] + 1;
    expect(gridsMatch(solved, off)).toBe(false);
  });

  it('false for a mismatched shape', () => {
    expect(gridsMatch(solved, [[1, 2, 3]])).toBe(false);
  });
});

describe('isImplausiblyFast', () => {
  it('rejects times below the per-difficulty floor', () => {
    expect(isImplausiblyFast('easy', MIN_SOLVE_MS.easy - 1)).toBe(true);
    expect(isImplausiblyFast('expert', 1000)).toBe(true);
  });

  it('accepts times at or above the floor', () => {
    expect(isImplausiblyFast('easy', MIN_SOLVE_MS.easy)).toBe(false);
    expect(isImplausiblyFast('hard', 120_000)).toBe(false);
  });

  it('floors increase with difficulty', () => {
    expect(MIN_SOLVE_MS.easy).toBeLessThan(MIN_SOLVE_MS.expert);
  });
});
