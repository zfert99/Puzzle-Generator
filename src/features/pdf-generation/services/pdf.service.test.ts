// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generatePuzzlePDF, generateKillerPDF, generateCalcPDF } from './pdf.service';
import { generatePuzzleBatch } from '@/features/engine/services/generation.service';
import { generateKillerSudoku } from '@/features/engine/killer/killer-sudoku';
import { generateCalcSudoku } from '@/features/engine/calc/calc-sudoku';

/**
 * Structural navigation assertions (QA F9). PDFKit writes object dictionaries in ASCII, so the
 * presence of an `/Outlines` tree (bookmarks) and `/Annots` arrays (the puzzle↔answer links) is
 * checkable on the raw bytes — the level the spec asks for, deliberately not a byte snapshot.
 */
function expectNavigationMetadata(pdf: Buffer) {
  const text = pdf.toString('latin1');
  expect(text).toContain('/Outlines');
  expect((text.match(/\/Annots/g) ?? []).length).toBeGreaterThan(0);
}

/**
 * Replaces the deleted ad-hoc `tests/test-pdfkit.js` spike scripts with a real,
 * colocated behavioural test. We drive the public `generatePuzzlePDF` end-to-end
 * with genuinely generated puzzles (no internal mocks) and assert the output is a
 * well-formed PDF binary.
 */
describe('generatePuzzlePDF', () => {
  it('returns a Buffer whose bytes start with the %PDF magic header', async () => {
    const puzzles = generatePuzzleBatch({ easy: 1, medium: 1 });

    const pdf = await generatePuzzlePDF(puzzles);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('produces a valid PDF even for a mix that includes mini grids', async () => {
    const puzzles = generatePuzzleBatch({ easy: 1, gridSize: 4 });

    const pdf = await generatePuzzlePDF(puzzles);

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('carries bookmarks and puzzle↔answer links (the F9 baseline the variants must match)', async () => {
    const pdf = await generatePuzzlePDF(generatePuzzleBatch({ easy: 1 }));
    expectNavigationMetadata(pdf);
  });
});

/**
 * F9 parity: classic booklets carried /Outlines + /Annots from the start; the Killer and Keisan
 * builders re-created the page loop without them. These pin the parity per variant.
 */
describe('generateKillerPDF navigation parity (F9)', () => {
  it('carries bookmarks and puzzle↔answer links', async () => {
    const pdf = await generateKillerPDF([generateKillerSudoku('easy')]);

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expectNavigationMetadata(pdf);
  });
});

describe('generateCalcPDF navigation parity (F9)', () => {
  it('carries bookmarks and puzzle↔answer links', async () => {
    const pdf = await generateCalcPDF([generateCalcSudoku('easy', { gridSize: 4 })]);

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expectNavigationMetadata(pdf);
  });
});
