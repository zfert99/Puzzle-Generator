import { generateCalcSudoku } from '../calc/calc-sudoku';
import type { CalcDifficulty } from '../calc/calc-types';
import { execSync } from 'child_process';
import { appendBenchmarkRows } from './benchmark-log';

/**
 * Generation benchmark for Keisan (Calcudoku) — the newly-merged engine had ZERO benchmark coverage
 * (review finding M2), despite AGENTS.md §3 requiring the tiered benchmarks whenever solving logic
 * changes. Generation is the meaningful cost here: every accepted puzzle is graded by the logical
 * solver (`calc-logical-solver`), so timing `generateCalcSudoku` end-to-end exercises the tier-5/6
 * bounded-recursion solver — the allocation-heavy `snapshot()`/`hasContradiction()` hot path — on
 * exactly the inputs it runs on in production.
 *
 * Run: `npx tsx src/features/engine/benchmarks/benchmark-calc.ts`
 * Appends one row per tier to `benchmark-logs.md`.
 */

// Randomized inputs (each call generates a fresh puzzle from `Math.random`) keep V8 from caching
// object shapes or eliminating work — the microbenchmarking caution in AGENTS.md §5.
const TIERS: { difficulty: CalcDifficulty; count: number }[] = [
  { difficulty: 'easy', count: 20 },
  { difficulty: 'medium', count: 20 },
  { difficulty: 'hard', count: 20 },
  { difficulty: 'expert', count: 10 },
  { difficulty: 'extreme', count: 5 },
];

/** Average wall-clock ms to generate `count` 9×9 puzzles of one tier. */
function benchTier(difficulty: CalcDifficulty, count: number): number {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Date.now();
    generateCalcSudoku(difficulty, { gridSize: 9 });
    times.push(Date.now() - start);
  }
  return times.reduce((a, b) => a + b, 0) / times.length;
}

function main(): void {
  const rows: string[] = [];
  const timestamp = new Date().toISOString();
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // Not in a git checkout — leave `commit` as 'unknown' rather than aborting the benchmark.
  }

  for (const { difficulty, count } of TIERS) {
    const label = `Keisan Gen 9×9 ${difficulty[0].toUpperCase()}${difficulty.slice(1)} (${count}x)`;
    console.log(`Generating ${count} ${difficulty} Keisan (9×9)...`);
    const avg = benchTier(difficulty, count);
    console.log(`  avg ${avg.toFixed(2)} ms/puzzle`);
    rows.push(`| ${timestamp} | \`${commit}\` | ${label} | ${avg.toFixed(2)} ms | N/A |\n`);
  }

  // One Mystery/No-Op row to keep that branch (operator-union combos) on the radar.
  console.log('Generating 10 hard Keisan (9×9, Mystery/no-op)...');
  const noOpTimes: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    generateCalcSudoku('hard', { gridSize: 9, noOp: true });
    noOpTimes.push(Date.now() - start);
  }
  const noOpAvg = noOpTimes.reduce((a, b) => a + b, 0) / noOpTimes.length;
  console.log(`  avg ${noOpAvg.toFixed(2)} ms/puzzle`);
  rows.push(`| ${timestamp} | \`${commit}\` | Keisan Gen 9×9 Hard Mystery (10x) | ${noOpAvg.toFixed(2)} ms | N/A |\n`);

  const logPath = appendBenchmarkRows(rows);
  console.log(`\nLogged ${rows.length} rows to ${logPath}`);
}

main();
