import { generateSudoku } from '../sudoku';
import { appendBenchmarkRows } from './benchmark-log';
import { SEED_BASE, currentCommit, distribution, logRow, mulberry32, timeDraws, warmUp } from './bench-utils';

/**
 * Classic generation per tier — the pipeline rows. Seeded since October 2026: draw i of a tier is
 * `generateSudoku(tier, 9, mulberry32(base + i))`, so the same puzzles are timed on every commit
 * and a row moves only when the code (or the generator's own output for a seed) does. Reports
 * the median and p90 beside the average: five Extremes are dominated by the one slow draw.
 */
function main(): void {
  const rows: string[] = [];
  const commit = currentCommit();
  const timestamp = new Date().toISOString();

  warmUp(() => generateSudoku('medium', 9, mulberry32(SEED_BASE.classic - 1)));

  const tiers = [
    { label: 'Pipeline Gen (10x Medium)', difficulty: 'medium' as const, count: 10, base: SEED_BASE.classic },
    { label: 'Pipeline Gen (10x Expert)', difficulty: 'expert' as const, count: 10, base: SEED_BASE.classic + 100 },
    { label: 'Pipeline Gen (5x Extreme)', difficulty: 'extreme' as const, count: 5, base: SEED_BASE.classic + 200 },
  ];
  for (const { label, difficulty, count, base } of tiers) {
    console.log(`Generating ${count} ${difficulty} puzzles...`);
    const s = timeDraws(count, (i) => {
      generateSudoku(difficulty, 9, mulberry32(base + i));
    });
    console.log(`  avg ${s.avg.toFixed(2)} ms · ${distribution(s)}`);
    rows.push(logRow(timestamp, commit, label, s.avg, distribution(s)));
  }

  console.log(`Logged results to ${appendBenchmarkRows(rows)}`);
}

main();
