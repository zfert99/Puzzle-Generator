import { generateSudoku } from '../sudoku';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main benchmark script for the overall Sudoku Generator.
 * 
 * Unlike the human-solver benchmark (which only tests the solving logic),
 * this script tests the ENTIRE generation pipeline for Expert puzzles.
 * 
 * The pipeline includes:
 * 1. Generating a random, valid full 9x9 grid.
 * 2. Digging holes one-by-one.
 * 3. Verifying the puzzle after EVERY single hole is dug by running it
 *    through the entire HumanSolver logic engine.
 * 
 * Because it verifies thousands of states per generated puzzle, this is the
 * heaviest operation in the entire codebase.
 */
async function main() {
  console.log('Generating 10 Expert puzzles...');
  const times: number[] = [];
  
  // We generate 10 expert puzzles to get a reliable average time.
  // We don't generate more because this process is intentionally CPU-intensive.
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    
    // Generate a single expert puzzle. The `generateSudoku` function is synchronous,
    // so it will block the event loop until the puzzle is completely finished.
    generateSudoku('expert');
    
    const end = Date.now();
    const duration = end - start; // Time taken in milliseconds
    
    times.push(duration);
    console.log(`Puzzle ${i + 1}: ${duration}ms`);
  }

  // Calculate total and average times across all 10 generations
  const total = times.reduce((a, b) => a + b, 0);
  const average = total / times.length;

  console.log(`\nTotal time: ${total}ms`);
  console.log(`Average time per Expert puzzle: ${average.toFixed(2)}ms`);

  console.log('\nGenerating 5 Extreme puzzles...');
  const extremeTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    generateSudoku('extreme');
    const end = Date.now();
    const duration = end - start;
    extremeTimes.push(duration);
    console.log(`Extreme Puzzle ${i + 1}: ${duration}ms`);
  }

  const extremeTotal = extremeTimes.reduce((a, b) => a + b, 0);
  const extremeAverage = extremeTotal / extremeTimes.length;

  console.log(`\nTotal Extreme time: ${extremeTotal}ms`);
  console.log(`Average time per Extreme puzzle: ${extremeAverage.toFixed(2)}ms`);

  // --- Auto-Logging ---
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const timestamp = new Date().toISOString();
    const logPath = path.join(__dirname, 'benchmark-logs.md');
    
    const logEntry1 = `| ${timestamp} | \`${commit}\` | Pipeline Gen (10x Expert) | ${average.toFixed(2)} ms | N/A |\n`;
    const logEntry2 = `| ${timestamp} | \`${commit}\` | Pipeline Gen (5x Extreme) | ${extremeAverage.toFixed(2)} ms | N/A |\n`;
    
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `# Benchmark Logs\n\n<!-- markdownlint-disable MD013 MD060 -->\n\n| Timestamp | Commit | Benchmark | Avg Time | Metric |\n|---|---|---|---|---|\n`);
    }
    fs.appendFileSync(logPath, logEntry1 + logEntry2);
    console.log(`Logged results to ${logPath}`);
  } catch (err) {
    console.error('Failed to log benchmark:', err);
  }
}

// Execute the benchmark
main();
