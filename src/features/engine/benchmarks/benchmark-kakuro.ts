import { execSync } from 'child_process';
import { generateKakuro, KAKURO_SIZES, type KakuroSize } from '../kakuro/kakuro';
import { KAKURO_LADDER, type KakuroLevel } from '../kakuro/kakuro-types';
import { appendBenchmarkRows } from './benchmark-log';

/**
 * Generation benchmark for Kakuro (plan slice E5): every tier at every shipped size, end to
 * end — layout, fill, repair-to-unique, the tier walk, exact verify and the classifier's label —
 * so it exercises both solvers on production-shaped inputs. Expert and extreme walk the
 * farthest from the natural distribution and are the rows to watch.
 *
 * Run: `npx tsx src/features/engine/benchmarks/benchmark-kakuro.ts [countPerCell]`
 * Appends one row per size × tier to `benchmark-logs.md`.
 */

// Randomized inputs (fresh `Math.random` puzzle per call) prevent V8 shape-caching / dead-code
// elimination — the microbenchmarking caution in AGENTS.md §5.
const COUNT = Number(process.argv[2]) || 10;

/** Wall-clock ms per puzzle over `count` generations of one size × tier. */
function benchCell(gridSize: KakuroSize, difficulty: KakuroLevel, count: number): { avg: number; max: number } {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    generateKakuro(difficulty, { gridSize });
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

  for (const gridSize of KAKURO_SIZES) {
    for (const difficulty of KAKURO_LADDER) {
      const label = `Kakuro Gen ${gridSize}×${gridSize} ${difficulty[0].toUpperCase()}${difficulty.slice(1)} (${COUNT}x)`;
      console.log(`Generating ${COUNT} ${difficulty} Kakuro (${gridSize}×${gridSize})...`);
      const { avg, max } = benchCell(gridSize, difficulty, COUNT);
      console.log(`  avg ${avg.toFixed(2)} ms/puzzle, max ${max.toFixed(0)} ms`);
      rows.push(`| ${timestamp} | \`${commit}\` | ${label} | ${avg.toFixed(2)} ms | max ${max.toFixed(0)} ms |\n`);
    }
  }

  console.log(`Appended ${rows.length} rows to ${appendBenchmarkRows(rows)}`);
}

main();
