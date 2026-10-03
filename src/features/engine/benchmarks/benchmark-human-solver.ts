import { HumanSolver } from '../human-solver';
import { generateSudoku, type Difficulty } from '../sudoku';
import { appendBenchmarkRows } from './benchmark-log';
import { SEED_BASE, currentCommit, distribution, logRow, mulberry32, stats, warmUp } from './bench-utils';

/**
 * HumanSolver throughput per tier. Each tier solves a POOL of distinct puzzles round-robin —
 * never one grid, which V8 would specialise on (AGENTS.md §5) — and the pool is SEEDED
 * (October 2026): puzzle i of a tier is `generateSudoku(difficulty, 9, mulberry32(base + i))`,
 * the same puzzle on every commit. The Extreme pool was 10 unseeded puzzles and its row moved
 * between 4 and 26 ms with no code change; it is 50 now, and comparable across runs. A row still
 * moves when a *generator* changes which puzzle a seed yields (the October 2026 Expert gate did).
 */
function generatePuzzlePool(size: number, difficulty: Difficulty, base: number): number[][][] {
  console.log(`Pre-generating a seeded pool of ${size} ${difficulty} puzzles...`);
  const pool: number[][][] = [];
  for (let i = 0; i < size; i++) pool.push(generateSudoku(difficulty, 9, mulberry32(base + i)).grid);
  return pool;
}

function main(): void {
  console.log('Running HumanSolver benchmarks across difficulty tiers...\n');

  const benchmarks = [
    { name: 'HumanSolver Basic', maxTier: 'basic' as const, difficulty: 'hard' as const, poolSize: 50, iterations: 5000, base: SEED_BASE.humanSolver },
    { name: 'HumanSolver Advanced', maxTier: 'advanced' as const, difficulty: 'expert' as const, poolSize: 50, iterations: 5000, base: SEED_BASE.humanSolver + 100 },
    { name: 'HumanSolver Extreme', maxTier: 'extreme' as const, difficulty: 'extreme' as const, poolSize: 50, iterations: 1000, base: SEED_BASE.humanSolver + 200 },
  ];

  const rows: string[] = [];
  const commit = currentCommit();
  const timestamp = new Date().toISOString();

  for (const { name, maxTier, difficulty, poolSize, iterations, base } of benchmarks) {
    const pool = generatePuzzlePool(poolSize, difficulty, base);
    // Untimed pass over the pool first: the first tier used to pay the solver's JIT compilation.
    warmUp(() => pool.forEach((grid) => new HumanSolver(grid).solve({ maxTier })), 1);

    console.log(`Running ${name} (${maxTier} tier) for ${iterations} iterations...`);
    const perSolve: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const grid = pool[i % pool.length];
      const start = performance.now();
      new HumanSolver(grid).solve({ maxTier });
      perSolve.push(performance.now() - start);
    }
    const s = stats(perSolve);
    const sps = Math.round(1000 / s.avg);
    console.log(`Average ${s.avg.toFixed(2)} ms · p50 ${s.median.toFixed(2)} · p90 ${s.p90.toFixed(2)} · ${sps} solves/sec\n`);
    rows.push(logRow(timestamp, commit, `${name} (${iterations}x)`, s.avg, `${sps} solves/sec · ${distribution(s)}`));
  }

  console.log(`Logged all tier results to ${appendBenchmarkRows(rows)}`);
}

main();
