import { HumanSolver } from '../lib/puzzle-engine/human-solver';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A known expert-level puzzle (requires advanced strategies to solve).
 * Note: This puzzle is notoriously difficult and requires multiple advanced
 * techniques (like X-Wings or Y-Wings) to complete logically. It's the perfect
 * stress test to ensure our solver is handling advanced logic quickly.
 */
const expertGrid = [
  [8, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 3, 6, 0, 0, 0, 0, 0],
  [0, 7, 0, 0, 9, 0, 2, 0, 0],
  [0, 5, 0, 0, 0, 7, 0, 0, 0],
  [0, 0, 0, 0, 4, 5, 7, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 3, 0],
  [0, 0, 1, 0, 0, 0, 0, 6, 8],
  [0, 0, 8, 5, 0, 0, 0, 1, 0],
  [0, 9, 0, 0, 0, 0, 4, 0, 0]
];

/**
 * Benchmark script specifically for the HumanSolver engine.
 * 
 * This isolates the logical deduction engine and tests raw solving speed.
 * It does NOT test generation (which involves digging holes and counting solutions).
 * High performance here is critical because the generator will call `solver.solve()`
 * dozens of times per puzzle when trying to create an 'Expert' level grid.
 */
async function main() {
  // We run 5,000 iterations to get a highly accurate average time, 
  // smoothing out any sudden CPU spikes or garbage collection pauses.
  const iterations = 5000;

  console.log(`Running HumanSolver on an expert puzzle for ${iterations} iterations...`);

  // We use performance.now() instead of Date.now() for sub-millisecond precision
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    // We instantiate a fresh solver every iteration so it starts from scratch,
    // exactly as it does in production.
    const solver = new HumanSolver(expertGrid);
    solver.solve();
  }

  const end = performance.now();
  const timeMs = end - start;

  console.log(`\nTotal time: ${timeMs.toFixed(2)} ms`);
  console.log(`Average time per solve: ${(timeMs / iterations).toFixed(2)} ms`);
  console.log(`Solves per second: ${Math.round(1000 / (timeMs / iterations))}`);

  // --- Auto-Logging ---
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const timestamp = new Date().toISOString();
    const logPath = path.join(__dirname, 'benchmark-logs.md');
    
    const avg = (timeMs / iterations).toFixed(2);
    const sps = Math.round(1000 / (timeMs / iterations));
    const logEntry = `| ${timestamp} | \`${commit}\` | HumanSolver (${iterations}x) | ${avg} ms | ${sps} solves/sec |\n`;
    
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `| Timestamp | Commit | Benchmark | Avg Time | Metric |\n|---|---|---|---|---|\n`);
    }
    fs.appendFileSync(logPath, logEntry);
    console.log(`Logged results to ${logPath}`);
  } catch (err) {
    console.error('Failed to log benchmark:', err);
  }
}

// Execute the benchmark
main();
