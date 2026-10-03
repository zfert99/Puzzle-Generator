import { generateKillerSudoku, type KillerDifficulty } from '../killer/killer-sudoku';
import { appendBenchmarkRows } from './benchmark-log';
import { SEED_BASE, currentCommit, distribution, logRow, mulberry32, timeDraws, warmUp } from './bench-utils';

/**
 * Killer generation per tier and size. Seeded (October 2026): draw i uses
 * `mulberry32(base + i)`, so the rows compare across commits; extreme is the tier whose
 * per-puzzle time spans 4–30 s, which is exactly why its average alone said little.
 */
const CELLS: { label: string; difficulty: KillerDifficulty; gridSize: 4 | 6 | 9; count: number; base: number }[] = [
  { label: 'Killer Gen 9×9 Easy (20x)', difficulty: 'easy', gridSize: 9, count: 20, base: SEED_BASE.killer },
  { label: 'Killer Gen 9×9 Medium (20x)', difficulty: 'medium', gridSize: 9, count: 20, base: SEED_BASE.killer + 100 },
  { label: 'Killer Gen 9×9 Hard (20x)', difficulty: 'hard', gridSize: 9, count: 20, base: SEED_BASE.killer + 200 },
  { label: 'Killer Gen 9×9 Expert (10x)', difficulty: 'expert', gridSize: 9, count: 10, base: SEED_BASE.killer + 300 },
  { label: 'Killer Gen 9×9 Extreme (5x)', difficulty: 'extreme', gridSize: 9, count: 5, base: SEED_BASE.killer + 400 },
  { label: 'Killer Gen 6×6 Hard (20x)', difficulty: 'hard', gridSize: 6, count: 20, base: SEED_BASE.killer + 500 },
  { label: 'Killer Gen 4×4 Easy (20x)', difficulty: 'easy', gridSize: 4, count: 20, base: SEED_BASE.killer + 600 },
];

function main(): void {
  const rows: string[] = [];
  const commit = currentCommit();
  const timestamp = new Date().toISOString();

  warmUp(() => generateKillerSudoku('easy', { gridSize: 9, rng: mulberry32(SEED_BASE.killer - 1) }));

  for (const { label, difficulty, gridSize, count, base } of CELLS) {
    console.log(`Generating ${count} ${difficulty} Killer (${gridSize}×${gridSize})...`);
    const s = timeDraws(count, (i) => {
      generateKillerSudoku(difficulty, { gridSize, rng: mulberry32(base + i) });
    });
    console.log(`  avg ${s.avg.toFixed(2)} ms · ${distribution(s)}`);
    rows.push(logRow(timestamp, commit, label, s.avg, distribution(s)));
  }

  console.log(`\nLogged ${rows.length} rows to ${appendBenchmarkRows(rows)}`);
}

main();
