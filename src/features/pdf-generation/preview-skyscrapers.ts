/**
 * Dev preview: write a Skyscrapers booklet — the served fixtures (one per planned size, 5×5 /
 * 6×6 / 7×7), each followed by its answer page — so the four-sided clue gutter, the framed play
 * area and the digit sizes can be eyeballed on paper. Until E5 lands a generator, the fixtures
 * are the only puzzles there are.
 *
 * Run: `npx tsx src/features/pdf-generation/preview-skyscrapers.ts [outfile.pdf]`
 */
import { writeFileSync } from 'node:fs';
import { SKYSCRAPERS_FIXTURES } from '../engine/skyscrapers/skyscrapers-fixtures';
import { generateSkyscrapersPDF } from './services/pdf.service';

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'skyscrapers-preview.pdf';
  const puzzles = [...SKYSCRAPERS_FIXTURES];
  const pdf = await generateSkyscrapersPDF(puzzles);
  writeFileSync(out, pdf);
  console.log(`Wrote ${pdf.length} bytes to ${out} (${puzzles.length} puzzles + answers).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
