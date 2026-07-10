import { HumanSolver } from '../human-solver';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { generateSudoku, Difficulty } from '../sudoku';

/**
 * We dynamically generate a pool of unique puzzles BEFORE the timer starts.
 * This prevents the V8 JavaScript engine from using Just-In-Time (JIT) compilation
 * to cache object shapes or perform dead-code elimination on a single static grid,
 * which would result in deceptively fast microbenchmark times.
 *
 * Crucially, each tier is benchmarked against a puzzle pool of a REPRESENTATIVE
 * difficulty. A prior version measured every tier against expert-only puzzles,
 * which made the "extreme" tier meaningless: expert puzzles are fully solvable by
 * advanced strategies, so the expensive extreme strategies (W-Wing, ALS-XZ, AIC)
 * were never actually invoked and the tier reported deceptively fast times. Giving
 * each tier puzzles that genuinely require that tier's strategies is what makes the
 * per-tier thresholds (Basic < 0.3ms, Extreme < 10ms) meaningful.
 */
function generatePuzzlePool(size: number, difficulty: Difficulty) {
  console.log(`Pre-generating pool of ${size} unique ${difficulty} puzzles to thwart V8 JIT caching...`);
  const pool = [];
  for (let i = 0; i < size; i++) {
    pool.push(generateSudoku(difficulty).grid);
  }
  return pool;
}

/**
 * Benchmark script specifically for the HumanSolver engine across difficulty tiers.
 * 
 * This isolates the logical deduction engine and tests raw solving speed for each tier:
 * - Basic Tier (Easy / Medium / Hard)
 * - Advanced Tier (Expert)
 * - Extreme Tier (Extreme / Impossible)
 */
async function main() {
  console.log('Running HumanSolver benchmarks across difficulty tiers...\n');

  const benchmarks = [
    { name: 'HumanSolver Basic', maxTier: 'basic' as const, difficulty: 'hard' as const, poolSize: 50, iterations: 5000 },
    { name: 'HumanSolver Advanced', maxTier: 'advanced' as const, difficulty: 'expert' as const, poolSize: 50, iterations: 5000 },
    { name: 'HumanSolver Extreme', maxTier: 'extreme' as const, difficulty: 'extreme' as const, poolSize: 10, iterations: 1000 }
  ];

  const logEntries: string[] = [];
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // Ignore git error
  }
  const timestamp = new Date().toISOString();

  for (const { name, maxTier, difficulty, poolSize, iterations } of benchmarks) {
    // Each tier gets a fresh pool of puzzles at a difficulty that genuinely
    // exercises that tier's strategies (see generatePuzzlePool docstring).
    const puzzlePool = generatePuzzlePool(poolSize, difficulty);

    console.log(`Running ${name} (${maxTier} tier) for ${iterations} iterations...`);

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Pick a puzzle from the pool sequentially to ensure V8 processes different data
      const grid = puzzlePool[i % puzzlePool.length];
      const solver = new HumanSolver(grid);
      solver.solve({ maxTier });
    }

    const end = performance.now();
    const timeMs = end - start;
    const avg = (timeMs / iterations).toFixed(2);
    const sps = Math.round(1000 / (timeMs / iterations));

    console.log(`Total time: ${timeMs.toFixed(2)} ms`);
    console.log(`Average time per solve: ${avg} ms`);
    console.log(`Solves per second: ${sps}\n`);

    logEntries.push(`| ${timestamp} | \`${commit}\` | ${name} (${iterations}x) | ${avg} ms | ${sps} solves/sec |\n`);
  }

  // --- Auto-Logging ---
  try {
    const logPath = path.join(__dirname, 'benchmark-logs.md');
    
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `# Benchmark Logs\n\n<!-- markdownlint-disable MD013 MD060 -->\n\n| Timestamp | Commit | Benchmark | Avg Time | Metric |\n|---|---|---|---|---|\n`);
    }
    for (const entry of logEntries) {
      fs.appendFileSync(logPath, entry);
    }
    console.log(`Logged all tier results to ${logPath}`);
  } catch (err) {
    console.error('Failed to log benchmark:', err);
  }
}

// Execute the benchmark
main();
