import { generateSkyscrapers } from '../skyscrapers/skyscrapers';
import { SKYSCRAPERS_SIZES, SKYSCRAPERS_TIERS_BY_SIZE } from '../skyscrapers/skyscrapers-types';
import { appendBenchmarkRows } from './benchmark-log';
import { SEED_BASE, currentCommit, distribution, logRow, mulberry32, timeDraws, warmUp } from './bench-utils';

/** Skyscrapers generation, every size × offered tier. `npx tsx … [count]` (default 10). Seeded since October 2026. */
const COUNT = Number(process.argv[2]) || 10;

function main(): void {
  const rows: string[] = [];
  const commit = currentCommit();
  const timestamp = new Date().toISOString();

  warmUp(() => generateSkyscrapers('easy', { gridSize: 5, rng: mulberry32(SEED_BASE.skyscrapers - 1) }));

  let cell = 0;
  for (const gridSize of SKYSCRAPERS_SIZES) {
    for (const difficulty of SKYSCRAPERS_TIERS_BY_SIZE[gridSize]) {
      const base = SEED_BASE.skyscrapers + 100 * cell++;
      const label = `Skyscrapers Gen ${gridSize}×${gridSize} ${difficulty[0].toUpperCase()}${difficulty.slice(1)} (${COUNT}x)`;
      console.log(`Generating ${COUNT} ${difficulty} Skyscrapers (${gridSize}×${gridSize})...`);
      const s = timeDraws(COUNT, (i) => {
        generateSkyscrapers(difficulty, { gridSize, rng: mulberry32(base + i) });
      });
      console.log(`  avg ${s.avg.toFixed(2)} ms · ${distribution(s)}`);
      rows.push(logRow(timestamp, commit, label, s.avg, distribution(s)));
    }
  }

  console.log(`Appended ${rows.length} rows to ${appendBenchmarkRows(rows)}`);
}

main();
