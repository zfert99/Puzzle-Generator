// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateCalcSudoku, generateCalcBatch } from './calc-sudoku';
import { CalcSolver } from './calc-solver';
import { CalcLogicalSolver } from './calc-logical-solver';
import { scoreCalcSolve } from './calc-score';
import { computeTarget, type CalcCage, type CalcDifficulty } from './calc-types';
import type { GridSize } from '../sudoku';

/** Deterministic LCG in [0, 1) so a failing random sample can be replayed from its logged seed. */
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

function cagesPartition(cages: CalcCage[], size: number): boolean {
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

describe('generateCalcSudoku', () => {
  const cases: { gridSize: 4 | 6 | 9; difficulty: CalcDifficulty }[] = [
    { gridSize: 4, difficulty: 'easy' },
    { gridSize: 4, difficulty: 'medium' },
    { gridSize: 4, difficulty: 'hard' },
    { gridSize: 6, difficulty: 'easy' },
    { gridSize: 6, difficulty: 'medium' },
    { gridSize: 6, difficulty: 'hard' },
    // K7a: 9×9, 3 tiers (givens-gradient, no score band).
    { gridSize: 9, difficulty: 'easy' },
    { gridSize: 9, difficulty: 'medium' },
    { gridSize: 9, difficulty: 'hard' },
  ];

  for (const { gridSize, difficulty } of cases) {
    it(`produces a valid, unique, in-band ${difficulty} ${gridSize}×${gridSize} puzzle`, () => {
      const puzzle = generateCalcSudoku(difficulty, { gridSize });
      expect(puzzle.variant).toBe('calc');
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.gridSize).toBe(gridSize);
      // No pre-filled givens — the cages are the clue.
      expect(puzzle.grid.flat().every((v) => v === 0)).toBe(true);
      // Well-formed: Latin square, cages partition every cell, arithmetic checks out.
      expect(isLatinSquare(puzzle.solution, gridSize)).toBe(true);
      expect(cagesPartition(puzzle.cages, gridSize)).toBe(true);
      expect(cagesSatisfied(puzzle.cages, puzzle.solution, gridSize)).toBe(true);
      // Uniquely solvable.
      expect(new CalcSolver(puzzle.cages, gridSize as GridSize).countSolutions(2)).toBe(1);
      // Logically solvable, and its score lands in the difficulty's band.
      const result = new CalcLogicalSolver(puzzle.cages, gridSize as GridSize).solve();
      expect(result.solved).toBe(true);
    });
  }

  it('easy tiers use the +/−/÷ palette (no × — factor reasoning is a difficulty step)', () => {
    for (const gridSize of [4, 6, 9] as const) {
      const p = generateCalcSudoku('easy', { gridSize });
      expect(p.cages.every((c) => c.op !== 'mul')).toBe(true);
    }
  });

  it('Mystery / No-Op (K6): generates unique, gradable puzzles with every operator hidden', () => {
    // No-op is an orthogonal toggle over any size/difficulty. The union table makes cages more
    // ambiguous, so uniqueness is verified across ALL operator interpretations — but it still holds.
    for (const gridSize of [4, 6] as const) {
      const p = generateCalcSudoku('medium', { gridSize, noOp: true });
      // Every multi-cell cage carries the hidden-operator flag; single-cell givens do not.
      for (const cage of p.cages) {
        if (cage.cells.length > 1) expect(cage.noOp).toBe(true);
        else expect(cage.noOp).toBeFalsy();
      }
      // Well-formed: Latin square, cages partition + satisfy the true operator.
      expect(isLatinSquare(p.solution, gridSize)).toBe(true);
      expect(cagesPartition(p.cages, gridSize)).toBe(true);
      expect(cagesSatisfied(p.cages, p.solution, gridSize)).toBe(true);
      // Unique AND logic-gradable WITHOUT knowing the operators (both solvers read the union table).
      expect(new CalcSolver(p.cages, gridSize as GridSize).countSolutions(2)).toBe(1);
      expect(new CalcLogicalSolver(p.cages, gridSize as GridSize).solve({ maxTier: 5 }).solved).toBe(true);
    }
  });

  it('9×9 Expert (K7c) is 0-given, needs a depth-1 Nishio guess, and is 9×9-only', () => {
    // Expert = the honest top of the ladder: unique, T4 can't finish it, T5 (Nishio) can. Generation
    // pays a T5 grade per candidate, so it is heavy-tailed: measured idle over 30 samples, p50 152ms
    // but max 1264ms (8.3× the median). Worst seen across 30 full-suite runs was 9897ms — worker
    // contention on top of that tail. 60s keeps ~6× headroom; the old 30s left only ~3×.
    const p = generateCalcSudoku('expert', { gridSize: 9 });
    expect(p.difficulty).toBe('expert');
    expect(p.gridSize).toBe(9);
    expect(p.cages.filter((c) => c.cells.length === 1).length).toBeLessThanOrEqual(1); // near-0 givens
    expect(new CalcSolver(p.cages, 9).countSolutions(2)).toBe(1); // unique
    expect(new CalcLogicalSolver(p.cages, 9).solve({ maxTier: 4 }).solved).toBe(false); // needs > T4
    const r5 = new CalcLogicalSolver(p.cages, 9).solve({ maxTier: 5 });
    expect(r5.solved).toBe(true);
    expect(r5.hardestTier).toBe(5);
    expect(r5.maxGuessDepth).toBe(1);
    // Expert exists only at 9×9 — 4×4/6×6 have no such config and must throw.
    expect(() => generateCalcSudoku('expert', { gridSize: 4 })).toThrow();
    expect(() => generateCalcSudoku('expert', { gridSize: 6 })).toThrow();
  }, 60_000);

  it('9×9 Extreme (K7d) needs MANY Nishio steps (≥6) — disjoint from Expert (≤5), 9×9-only', async () => {
    // Extreme is the honest fifth tier: the guess-step COUNT (not depth) is the axis. Generation is
    // slow (rare, ~1% accept, each candidate pays a T5 grade) AND heavy-tailed, which is why the
    // timeout is this large. Measured idle over 30 samples: p50 1663ms, p90 5019ms, max 11635ms
    // (7× the median). Under suite contention a bad draw compounds — this test was seen at 35094ms
    // and timed out against its former 30s. 120s matches the sibling Killer extreme test and keeps
    // real headroom. Do NOT trim this back: the tail is intrinsic to a ~1%-accept search.
    const p = generateCalcSudoku('extreme', { gridSize: 9 });
    expect(p.difficulty).toBe('extreme');
    expect(new CalcSolver(p.cages, 9).countSolutions(2)).toBe(1);
    const r = new CalcLogicalSolver(p.cages, 9).solve({ maxTier: 5 });
    expect(r.solved).toBe(true);
    expect(r.hardestTier).toBe(5); // still the Nishio tier — depth never exceeds 1 (K7b)
    expect(r.guessSteps).toBeGreaterThanOrEqual(6); // MANY steps — the Extreme band (Expert caps at 5)
    expect(() => generateCalcSudoku('extreme', { gridSize: 4 })).toThrow();
    expect(() => generateCalcSudoku('extreme', { gridSize: 6 })).toThrow();
  }, 120_000);

  it('9×9 tiers separate on a disjoint givens gradient (easy ≥12 > medium 6–11 > hard ≤3)', () => {
    // K7a: the tiers are defined by single-cell-cage (given) count, not a score band. The ranges are
    // disjoint by construction, so the tier ordering holds sample-to-sample.
    const singles = (d: CalcDifficulty) =>
      generateCalcSudoku(d, { gridSize: 9 }).cages.filter((c) => c.cells.length === 1).length;
    expect(singles('easy')).toBeGreaterThanOrEqual(12);
    const med = singles('medium');
    expect(med).toBeGreaterThanOrEqual(6);
    expect(med).toBeLessThanOrEqual(11);
    expect(singles('hard')).toBeLessThanOrEqual(3);
  });

  it('hard is structurally chunky: ~1 given and bigger cages (the rebalance)', () => {
    // 6×6 hard should carry few single-cell givens and reach size-4 cages.
    let totalSingles = 0;
    let sawFourCell = false;
    for (let i = 0; i < 6; i++) {
      const p = generateCalcSudoku('hard', { gridSize: 6 });
      totalSingles += p.cages.filter((c) => c.cells.length === 1).length;
      if (p.cages.some((c) => c.cells.length === 4)) sawFourCell = true;
    }
    expect(totalSingles / 6).toBeLessThanOrEqual(1); // maxSingles: 0 on 6×6 hard (allow slack)
    expect(sawFourCell).toBe(true); // maxSize: 4 on 6×6 hard
  });

  it('hard leans on × (operator-mix weighting), keeps −/÷ variety, and is bent-heavy', () => {
    // This test asserts three AGGREGATE ratios over a random sample, so its thresholds are a
    // statistics problem, not a taste one — each must sit far enough below its true mean that
    // sampling noise alone can't trip it. Measured over 300–400 independent trials:
    //
    //   statistic              mean    sd(N=14)  sd(N=28)   threshold   margin at N=28
    //   bent / multi           0.482    0.039     0.027       > 0.39      3.5 sd
    //   mul / multi            0.380    0.032       —         > 0.25      4.1 sd
    //   puzzlesWithSubDiv / N  0.935    0.067       —         > 0.60      5.0 sd
    //
    // N was 14 with a bent threshold of 0.40 — only 2.1 sd, which failed ~2.0% of runs (6/300)
    // and was a live CI flake. The 0.40 came from a documented "~61% bent" figure that measurement
    // does not support: it was 0.527 even at the commit that wrote it, and the operator reweight
    // (restoring −/÷, which are 2-cell-only ops → more 2-cell cages → fewer bent ones, since a
    // 2-cell cage is always collinear) then moved it to ~0.48. See
    // `Docs/research/keisan-test-flake-and-bent-ratio-divergence.md`.
    //
    // N=28 (not a bigger N): it halves the sd for 2× runtime and holds detection power identical
    // to the original test, whereas N=52 would push this test to ~17 s under suite load for a
    // property already guarded at 3.5 sd. 28 also clears the conventional ≥30-run-ish floor for
    // characterising a randomised algorithm far better than 14 did.
    //
    // The sample stays RANDOM rather than fixed-seed — a pinned seed would stop this from catching
    // a distribution shift that happens to spare that seed, which is the whole point of the test.
    // Instead the seed is drawn randomly and reported on failure, so any red run is reproducible:
    // re-run with SEED hard-coded to replay the exact 28 boards.
    const seed = Math.floor(Math.random() * 0x100000000);
    const rng = seededRng(seed);
    let mul = 0;
    let multi = 0;
    let bent = 0;
    let puzzlesWithSubDiv = 0;
    const N = 28;
    for (let i = 0; i < N; i++) {
      const p = generateCalcSudoku('hard', { gridSize: 6, rng });
      let sd = false;
      for (const c of p.cages) {
        if (c.cells.length < 2) continue;
        if (c.op === 'mul') mul += 1;
        if (c.op === 'sub' || c.op === 'div') { sd = true; }
        multi += 1;
        const rows = new Set(c.cells.map((cell) => Math.floor(cell / 6)));
        const cols = new Set(c.cells.map((cell) => cell % 6));
        if (rows.size >= 2 && cols.size >= 2) bent += 1;
      }
      if (sd) puzzlesWithSubDiv += 1;
    }
    const replay = `seed=${seed} (hard-code this seed to reproduce)`;
    // −/÷ variety: the over-× first cut left them nearly absent; most hard boards should now have some.
    expect(puzzlesWithSubDiv / N, replay).toBeGreaterThan(0.6);
    expect(mul / multi, replay).toBeGreaterThan(0.25); // still ×-weighted (mean ~0.38; doc: ≥30%)
    expect(bent / multi, replay).toBeGreaterThan(0.39); // bent-heavy from maxSize-4 (not gated)
  });

  it('bands are disjoint per size: easy < medium < hard by score (6×6)', () => {
    const scoreOf = (difficulty: CalcDifficulty) => {
      const p = generateCalcSudoku(difficulty, { gridSize: 6 });
      return scoreCalcSolve(new CalcLogicalSolver(p.cages, 6).solve()).final;
    };
    // Sample a few of each and compare band extremes (bands are cut disjoint, so max(easy) ≤
    // min(medium) etc. hold by construction — a light check that the gate is wired).
    const easy = Math.max(...Array.from({ length: 5 }, () => scoreOf('easy')));
    const hard = Math.min(...Array.from({ length: 5 }, () => scoreOf('hard')));
    expect(easy).toBeLessThan(hard);
  });
});

describe('generateCalcBatch', () => {
  it('returns the requested counts of each difficulty', () => {
    const batch = generateCalcBatch({ easy: 2, medium: 1, hard: 1 }, { gridSize: 4 });
    expect(batch).toHaveLength(4);
    expect(batch.filter((p) => p.difficulty === 'easy')).toHaveLength(2);
    expect(batch.filter((p) => p.difficulty === 'medium')).toHaveLength(1);
    expect(batch.filter((p) => p.difficulty === 'hard')).toHaveLength(1);
  });
});
