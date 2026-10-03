import { generateKakuro, KAKURO_SIZES, type KakuroSize } from '../kakuro/kakuro';
import { KAKURO_LADDER, type KakuroLevel } from '../kakuro/kakuro-types';
import { appendBenchmarkRows } from './benchmark-log';
import { SEED_BASE, currentCommit, distribution, logRow, mulberry32, timeDraws, warmUp } from './bench-utils';

/** Kakuro generation, every size × tier. `npx tsx … [count]` (default 10). Seeded since October 2026. */
const COUNT = Number(process.argv[2]) || 10;

function main(): void {
  const rows: string[] = [];
  const commit = currentCommit();
  const timestamp = new Date().toISOString();

  warmUp(() => generateKakuro('easy', { gridSize: 6, rng: mulberry32(SEED_BASE.kakuro - 1) }));

  let cell = 0;
  for (const gridSize of KAKURO_SIZES) {
    for (const difficulty of KAKURO_LADDER) {
      const base = SEED_BASE.kakuro + 100 * cell++;
      const label = `Kakuro Gen ${gridSize}×${gridSize} ${difficulty[0].toUpperCase()}${difficulty.slice(1)} (${COUNT}x)`;
      console.log(`Generating ${COUNT} ${difficulty} Kakuro (${gridSize}×${gridSize})...`);
      const s = timeDraws(COUNT, (i) => {
        generateKakuro(difficulty as KakuroLevel, { gridSize: gridSize as KakuroSize, rng: mulberry32(base + i) });
      });
      console.log(`  avg ${s.avg.toFixed(2)} ms · ${distribution(s)}`);
      rows.push(logRow(timestamp, commit, label, s.avg, distribution(s)));
    }
  }

  console.log(`Appended ${rows.length} rows to ${appendBenchmarkRows(rows)}`);
}

main();
