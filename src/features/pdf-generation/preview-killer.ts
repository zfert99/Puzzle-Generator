/**
 * Dev preview: generate a Killer Sudoku booklet (N of each difficulty + answer pages) so the
 * puzzles — empty grid + dashed cages + sums — can be eyeballed.
 *
 * Run: `npx tsx src/features/pdf-generation/preview-killer.ts [outfile.pdf] [countPerDifficulty]`
 */
import { writeFileSync } from 'node:fs';
import { generateKillerBatch } from '../engine/killer/killer-sudoku';
import { generateKillerPDF } from './services/pdf.service';

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'killer-preview.pdf';
  const count = Number(process.argv[3]) || 2;
  const puzzles = [
    ...generateKillerBatch({ easy: count, medium: count, hard: count, expert: count, extreme: count }),
    // A 6×6 section — the beginner variant (digits 1–6, easy/medium/hard).
    ...generateKillerBatch({ easy: count, medium: count, hard: count }, { gridSize: 6 }),
  ];
  const pdf = await generateKillerPDF(puzzles);
  writeFileSync(out, pdf);
  console.log(`Wrote ${pdf.length} bytes to ${out} (${puzzles.length} puzzles + answers).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
