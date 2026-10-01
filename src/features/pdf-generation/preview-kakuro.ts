/**
 * Dev preview: write a Kakuro booklet — the served fixtures (the full ladder at 7×7 and 9×9),
 * each followed by its answer page — so the clue gutter, shaded blocks, diagonals and sums can
 * be eyeballed on paper. Until E5 lands a generator, the fixtures are the only puzzles there are.
 *
 * Run: `npx tsx src/features/pdf-generation/preview-kakuro.ts [outfile.pdf]`
 */
import { writeFileSync } from 'node:fs';
import { KAKURO_FIXTURES } from '../engine/kakuro/kakuro-fixtures';
import { generateKakuroPDF } from './services/pdf.service';

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'kakuro-preview.pdf';
  const puzzles = [...KAKURO_FIXTURES];
  const pdf = await generateKakuroPDF(puzzles);
  writeFileSync(out, pdf);
  console.log(`Wrote ${pdf.length} bytes to ${out} (${puzzles.length} puzzles + answers).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
