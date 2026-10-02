// @vitest-environment node
import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { generatePuzzlePDF, generateKillerPDF, generateCalcPDF, generateKakuroPDF, generateSkyscrapersPDF, drawSkyscrapersGrid } from './pdf.service';
import { generatePuzzleBatch } from '@/features/engine/services/generation.service';
import { generateKillerSudoku } from '@/features/engine/killer/killer-sudoku';
import { generateCalcSudoku } from '@/features/engine/calc/calc-sudoku';
import { findKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';
import { SKYSCRAPERS_FIXTURES, SKYSCRAPERS_FIXTURE_5X5 } from '@/features/engine/skyscrapers/skyscrapers-fixtures';
import { presentClueCount } from '@/features/engine/skyscrapers/skyscrapers-types';

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

describe('generateKakuroPDF (V3)', () => {
  it('renders the baked fixtures at both sizes with bookmarks and puzzle↔answer links', async () => {
    const pdf = await generateKakuroPDF([findKakuroFixture(7, 'easy')!, findKakuroFixture(9, 'extreme')!]);

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expectNavigationMetadata(pdf);
    // Two puzzle pages + two answer pages + the title page.
    expect((pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length).toBe(5);
  });
});

describe('generateSkyscrapersPDF (V3)', () => {
  it('renders the baked fixtures at all three sizes with bookmarks and puzzle↔answer links', async () => {
    const pdf = await generateSkyscrapersPDF([...SKYSCRAPERS_FIXTURES]);

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expectNavigationMetadata(pdf);
    // Three puzzle pages + three answer pages + the title page.
    expect((pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length).toBe(7);
  });

  /** Render one page with stream compression off so the content stream is readable text. */
  async function renderPage(answer: boolean): Promise<string> {
    const doc = new PDFDocument({ compress: false, margin: 50 });
    const buffers: Buffer[] = [];
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    drawSkyscrapersGrid(doc, SKYSCRAPERS_FIXTURE_5X5, 50, 50, 420, answer);
    doc.end();
    return (await done).toString('latin1');
  }

  it('draws every present clue (and nothing for a blank), and the heights only on the answer page', async () => {
    const puzzlePage = await renderPage(false);
    const answerPage = await renderPage(true);
    // PDFKit emits each single-digit `text()` call as a `[<hh> 0] TJ` show operator (one hex glyph
    // code); count those. Titles and links are not drawn here, so every show is a digit.
    const shows = (page: string) => (page.match(/\[<[0-9a-f]{2}> 0\] TJ/g) ?? []).length;

    expect(shows(puzzlePage)).toBe(presentClueCount(SKYSCRAPERS_FIXTURE_5X5.clues)); // 5 clues, no heights
    expect(shows(answerPage)).toBe(presentClueCount(SKYSCRAPERS_FIXTURE_5X5.clues) + 25); // + every height
  });
});