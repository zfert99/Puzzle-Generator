import { execSync } from 'child_process';
import { generateSkyscrapers, SKYSCRAPERS_TIERS_BY_SIZE } from '../skyscrapers/skyscrapers';
import { SKYSCRAPERS_SIZES } from '../skyscrapers/skyscrapers-types';
import { appendBenchmarkRows } from './benchmark-log';

/**
 * Generation benchmark for Skyscrapers (plan slice E5): every offered tier at every shipped size,
 * end to end — Latin fill, repair-to-unique with restarts, tier-bounded clue removal to exactly
 * the requested tier, and the classifier's label — so it exercises both solvers on
 * production-shaped inputs. The rare cells (5×5 hard, 7×7 expert) draw the most squares and are
 * the rows to watch.
 *
 * Run: `npx tsx src/features/engine/benchmarks/benchmark-skyscrapers.ts [countPerCell]`
 * Appends one row per size × offered tier to `benchmark-logs.md`.
 */

// Randomized inputs (fresh `Math.random` puzzle per call) prevent V8 shape-caching / dead-code
// elimination — the microbenchmarking caution in AGENTS.md §5.
const COUNT = Number(process.argv[2]) || 10;

function benchCell(gridSize: (typeof SKYSCRAPERS_SIZES)[number], difficulty: (typeof SKYSCRAPERS_TIERS_BY_SIZE)[5][number], count: number): { avg: number; max: number } {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    generateSkyscrapers(difficulty, { gridSize });
    times.push(performance.now() - start);
  }
  return { avg: times.reduce((a, b) => a + b, 0) / times.length, max: Math.max(...times) };
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

  for (const gridSize of SKYSCRAPERS_SIZES) {
    for (const difficulty of SKYSCRAPERS_TIERS_BY_SIZE[gridSize]) {
      const label = `Skyscrapers Gen ${gridSize}×${gridSize} ${difficulty[0].toUpperCase()}${difficulty.slice(1)} (${COUNT}x)`;
      console.log(`Generating ${COUNT} ${difficulty} Skyscrapers (${gridSize}×${gridSize})...`);
      const { avg, max } = benchCell(gridSize, difficulty, COUNT);
      console.log(`  avg ${avg.toFixed(2)} ms/puzzle, max ${max.toFixed(0)} ms`);
      rows.push(`| ${timestamp} | \`${commit}\` | ${label} | ${avg.toFixed(2)} ms | max ${max.toFixed(0)} ms |\n`);
    }
  }

  console.log(`Appended ${rows.length} rows to ${appendBenchmarkRows(rows)}`);
}

main();
