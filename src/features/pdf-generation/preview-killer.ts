/**
 * Dev preview: generate one Killer Sudoku per difficulty and write a PDF booklet so the puzzles
 * (empty grid + dashed cages + sums, plus answer pages) can be eyeballed.
 *
 * Run: `npx tsx src/features/pdf-generation/preview-killer.ts [outfile.pdf]`
 */
import { writeFileSync } from 'node:fs';
import { generateKillerSudoku } from '../engine/killer/killer-sudoku';
import { generateKillerPDF } from './services/pdf.service';

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'killer-preview.pdf';
  const puzzles = [
    generateKillerSudoku('easy'),
    generateKillerSudoku('medium'),
    generateKillerSudoku('hard'),
  ];
  const pdf = await generateKillerPDF(puzzles);
  writeFileSync(out, pdf);
  console.log(`Wrote ${pdf.length} bytes to ${out} (${puzzles.length} puzzles + answers).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
