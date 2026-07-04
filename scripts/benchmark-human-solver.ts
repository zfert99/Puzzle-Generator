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
  } catch (e) {
    // Ignore git error
  }
  const timestamp = new Date().toISOString();

  for (const { name, maxTier, iterations } of benchmarks) {
    console.log(`Running ${name} (${maxTier} tier) for ${iterations} iterations...`);

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const solver = new HumanSolver(expertGrid);
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
