import { generateKillerSudoku, type KillerDifficulty } from '../killer/killer-sudoku';
import { execSync } from 'child_process';
import { appendBenchmarkRows } from './benchmark-log';

/**
 * Generation benchmark for Killer Sudoku — the merged engine had ZERO benchmark coverage (review
 * finding M2), despite AGENTS.md §3. Generation is the meaningful cost: every accepted puzzle is
 * graded by the logical solver and (once) uniqueness-checked, so timing `generateKillerSudoku`
 * end-to-end exercises the solver on production-shaped inputs. Extreme is the slow tier
 * (tier-5-necessary layouts are rare, ~5.5 s each), which is exactly why it needs a tracked baseline.
 *
 * Run: `npx tsx src/features/engine/benchmarks/benchmark-killer.ts`
 * Appends one row per tier to `benchmark-logs.md`.
 */

// Randomized inputs (fresh `Math.random` puzzle per call) prevent V8 shape-caching / dead-code
// elimination — the microbenchmarking caution in AGENTS.md §5.
const TIERS: { difficulty: KillerDifficulty; count: number }[] = [
  { difficulty: 'easy', count: 20 },
  { difficulty: 'medium', count: 20 },
  { difficulty: 'hard', count: 20 },
  { difficulty: 'expert', count: 10 },
  { difficulty: 'extreme', count: 5 },
];

/** Average wall-clock ms to generate `count` 9×9 puzzles of one tier. */
function benchTier(difficulty: KillerDifficulty, count: number): number {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Date.now();
    generateKillerSudoku(difficulty, { gridSize: 9 });
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
    const label = `Killer Gen 9×9 ${difficulty[0].toUpperCase()}${difficulty.slice(1)} (${count}x)`;
    console.log(`Generating ${count} ${difficulty} Killer (9×9)...`);
    const avg = benchTier(difficulty, count);
    console.log(`  avg ${avg.toFixed(2)} ms/puzzle`);
    rows.push(`| ${timestamp} | \`${commit}\` | ${label} | ${avg.toFixed(2)} ms | N/A |\n`);
  }

  // One 6×6 row — the beginner variant (digits 1–6, easy/medium/hard only).
  console.log('Generating 20 hard Killer (6×6)...');
  const miniTimes: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = Date.now();
    generateKillerSudoku('hard', { gridSize: 6 });
    miniTimes.push(Date.now() - start);
  }
  const miniAvg = miniTimes.reduce((a, b) => a + b, 0) / miniTimes.length;
  console.log(`  avg ${miniAvg.toFixed(2)} ms/puzzle`);
  rows.push(`| ${timestamp} | \`${commit}\` | Killer Gen 6×6 Hard (20x) | ${miniAvg.toFixed(2)} ms | N/A |\n`);

  const logPath = appendBenchmarkRows(rows);
  console.log(`\nLogged ${rows.length} rows to ${logPath}`);
}

main();
