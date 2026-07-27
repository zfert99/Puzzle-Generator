/**
 * Dev preview: generate a Keisan (Calcudoku) booklet (N of each difficulty + answer pages) so the
 * puzzles — empty grid + dashed cages + target/operator labels — can be eyeballed.
 *
 * Run: `npx tsx src/features/pdf-generation/preview-calc.ts [outfile.pdf] [countPerDifficulty] [--mystery]`
 *   --mystery : hide the cage operators (No-Op mode) — the label shows only the target.
 */
import { writeFileSync } from 'node:fs';
import { generateCalcBatch } from '../engine/calc/calc-sudoku';
import { generateCalcPDF } from './services/pdf.service';

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'keisan-preview.pdf';
  const count = Number(process.argv[3]) || 2;
  const noOp = process.argv.includes('--mystery');
  // 9×9 carries the full 5-tier ladder; expert/extreme are 9×9-only.
  const puzzles = generateCalcBatch(
    { easy: count, medium: count, hard: count, expert: count, extreme: count },
    { gridSize: 9, noOp },
  );
  const pdf = await generateCalcPDF(puzzles);
  writeFileSync(out, pdf);
  console.log(`Wrote ${pdf.length} bytes to ${out} (${puzzles.length} puzzles + answers${noOp ? ', Mystery/no-op' : ''}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
