import { HumanSolver } from '../human-solver';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { generateSudoku } from '../sudoku';

/**
 * We dynamically generate a pool of unique expert puzzles BEFORE the timer starts.
 * This prevents the V8 JavaScript engine from using Just-In-Time (JIT) compilation
 * to cache object shapes or perform dead-code elimination on a single static grid,
 * which would result in deceptively fast microbenchmark times.
 */
function generatePuzzlePool(size: number) {
  console.log(`Pre-generating pool of ${size} unique expert puzzles to thwart V8 JIT caching...`);
  const pool = [];
  for (let i = 0; i < size; i++) {
    pool.push(generateSudoku('expert').grid);
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
    { name: 'HumanSolver Basic', maxTier: 'basic' as const, iterations: 5000 },
    { name: 'HumanSolver Advanced', maxTier: 'advanced' as const, iterations: 5000 },
    { name: 'HumanSolver Extreme', maxTier: 'extreme' as const, iterations: 1000 }
  ];

  const logEntries: string[] = [];
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // Ignore git error
  }
  const timestamp = new Date().toISOString();

  const puzzlePool = generatePuzzlePool(50);

  for (const { name, maxTier, iterations } of benchmarks) {
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
