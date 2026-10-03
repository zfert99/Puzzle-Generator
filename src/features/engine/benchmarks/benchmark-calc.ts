import { generateCalcSudoku } from '../calc/calc-sudoku';
import type { CalcDifficulty } from '../calc/calc-types';
import { appendBenchmarkRows } from './benchmark-log';
import { SEED_BASE, currentCommit, distribution, logRow, mulberry32, timeDraws, warmUp } from './bench-utils';

/** Keisan generation per 9×9 tier, plus the Mystery (no-op) hard row. Seeded since October 2026. */
const CELLS: { label: string; difficulty: CalcDifficulty; count: number; noOp?: boolean; base: number }[] = [
  { label: 'Keisan Gen 9×9 Easy (20x)', difficulty: 'easy', count: 20, base: SEED_BASE.calc },
  { label: 'Keisan Gen 9×9 Medium (20x)', difficulty: 'medium', count: 20, base: SEED_BASE.calc + 100 },
  { label: 'Keisan Gen 9×9 Hard (20x)', difficulty: 'hard', count: 20, base: SEED_BASE.calc + 200 },
  { label: 'Keisan Gen 9×9 Expert (10x)', difficulty: 'expert', count: 10, base: SEED_BASE.calc + 300 },
  { label: 'Keisan Gen 9×9 Extreme (5x)', difficulty: 'extreme', count: 5, base: SEED_BASE.calc + 400 },
  { label: 'Keisan Gen 9×9 Hard Mystery (10x)', difficulty: 'hard', count: 10, noOp: true, base: SEED_BASE.calc + 500 },
];

function main(): void {
  const rows: string[] = [];
  const commit = currentCommit();
  const timestamp = new Date().toISOString();

  warmUp(() => generateCalcSudoku('easy', { gridSize: 9, rng: mulberry32(SEED_BASE.calc - 1) }));

  for (const { label, difficulty, count, noOp, base } of CELLS) {
    console.log(`Generating ${count} ${difficulty} Keisan (9×9${noOp ? ', Mystery' : ''})...`);
    const s = timeDraws(count, (i) => {
      generateCalcSudoku(difficulty, { gridSize: 9, noOp, rng: mulberry32(base + i) });
    });
    console.log(`  avg ${s.avg.toFixed(2)} ms · ${distribution(s)}`);
    rows.push(logRow(timestamp, commit, label, s.avg, distribution(s)));
  }

  console.log(`\nLogged ${rows.length} rows to ${appendBenchmarkRows(rows)}`);
}

main();
