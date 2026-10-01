import PDFDocument from 'pdfkit';
import { SudokuPuzzle, getGridConfig, type GridSize, type GridConfig } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import { computeCageOutline, type LabeledCage } from '@/features/engine/killer/cage-geometry';
import type { CalcPuzzle, CalcOperator } from '@/features/engine/calc/calc-types';
import { calcGridConfig } from '@/features/engine/calc/calc-generator';
import type { KakuroPuzzle } from '@/features/engine/kakuro/kakuro-types';
import { buildClues, kakuroTracks, whiteMaskOf } from '@/features/engine/kakuro/kakuro-layout';

/**
 * PDF-safe operator glyphs. PDFKit's built-in Helvetica encodes text as **WinAnsi**, and the math
 * MINUS SIGN (`−`, U+2212 — what `OPERATOR_SYMBOL` uses on screen) is NOT a WinAnsi character: it
 * gets written as the two-byte sequence `0x22 0x12`, so byte `0x22` renders as a stray `"`
 * (quotedbl). The ASCII hyphen (`-`, U+002D) is WinAnsi-safe. `×` (0xD7) and `÷` (0xF7) ARE WinAnsi
 * bytes and render correctly, so they stay. On-screen labels keep the prettier U+2212 minus.
 */
const PDF_OPERATOR_SYMBOL: Record<CalcOperator, string> = { add: '+', sub: '-', mul: '×', div: '÷' };

export function drawTitlePage(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  doc.fontSize(36).text('Sudoku Puzzle Book', { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(18).text('Generated specifically for you.', { align: 'center' });
}

/**
 * A digit centred in the cell whose top-left corner is (x, y), at the document's current font
 * size. The vertical nudge of a tenth of the text height compensates for Helvetica's glyphs
 * sitting above the box's centre line. Every renderer centres digits this way; this is the one
 * copy of the formula.
 */
function drawCenteredDigit(doc: PDFKit.PDFDocument, text: string, x: number, y: number, cell: number): void {
  const textWidth = doc.widthOfString(text);
  const textHeight = doc.heightOfString(text);
  doc.text(text, x + (cell - textWidth) / 2, y + (cell - textHeight) / 2 + textHeight * 0.1, { lineBreak: false });
}

export function drawGrid(doc: PDFKit.PDFDocument, grid: number[][], startX: number, startY: number, gridDrawSize: number): void {
  const puzzleSize = grid.length;
  const config = getGridConfig(puzzleSize as GridSize);
  const cellSize = gridDrawSize / puzzleSize;

  doc.lineWidth(1);
  doc.fontSize(cellSize * 0.6);

  for (let i = 0; i < puzzleSize; i++) {
    for (let j = 0; j < puzzleSize; j++) {
      const val = grid[i][j];
      if (val !== 0) drawCenteredDigit(doc, val.toString(), startX + j * cellSize, startY + i * cellSize, cellSize);
    }
  }

  // Boxless (Latin-square-only) grids have no box borders — every interior line is thin, only
  // the outer frame is heavier. Box-tileable grids get thick lines at box boundaries.
  for (let i = 0; i <= puzzleSize; i++) {
    const isFrame = i === 0 || i === puzzleSize;
    const isThickRow = config.hasBoxes ? i % config.boxHeight === 0 : isFrame;
    const isThickCol = config.hasBoxes ? i % config.boxWidth === 0 : isFrame;

    doc.lineWidth(isThickRow ? 3 : 1);
    doc.moveTo(startX, startY + i * cellSize)
      .lineTo(startX + gridDrawSize, startY + i * cellSize)
      .stroke();

    doc.lineWidth(isThickCol ? 3 : 1);
    doc.moveTo(startX + i * cellSize, startY)
      .lineTo(startX + i * cellSize, startY + gridDrawSize)
      .stroke();
  }
}

/**
 * Draw a caged grid (Killer or Keisan): the base grid + digits (empty for a puzzle, the solution
 * for an answer), plus dashed cage outlines and each cage's corner label. Shared by both variants;
 * the caller supplies the `GridConfig` (box-tileable for Killer, boxless for Keisan — which drives
 * whether box borders are drawn) and the pre-formatted `LabeledCage`s (Killer's sum, Keisan's
 * target+operator). A small white pad behind each label keeps it legible over the dashed border.
 */
function drawCagedGrid(
  doc: PDFKit.PDFDocument,
  opts: {
    config: GridConfig;
    grid: number[][];
    cages: LabeledCage[];
    startX: number;
    startY: number;
    gridDrawSize: number;
  },
): void {
  const { config, grid, cages, startX, startY, gridDrawSize } = opts;
  const size = config.size;
  const cell = gridDrawSize / size;
  const inset = cell * 0.09;

  // Digits (solution on an answer page; nothing on the puzzle page — neither variant has givens).
  doc.fillColor('black').fontSize(cell * 0.5);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (v !== 0) drawCenteredDigit(doc, String(v), startX + c * cell, startY + r * cell, cell);
    }
  }

  // Base grid: thin cell lines, thick box lines. Boxless (Latin-square-only) grids — Keisan — have
  // no box borders, so only the outer frame is heavier (K0).
  doc.strokeColor('black');
  for (let i = 0; i <= size; i++) {
    const isFrame = i === 0 || i === size;
    doc.lineWidth((config.hasBoxes ? i % config.boxHeight === 0 : isFrame) ? 2 : 0.5);
    doc.moveTo(startX, startY + i * cell).lineTo(startX + gridDrawSize, startY + i * cell).stroke();
    doc.lineWidth((config.hasBoxes ? i % config.boxWidth === 0 : isFrame) ? 2 : 0.5);
    doc.moveTo(startX + i * cell, startY).lineTo(startX + i * cell, startY + gridDrawSize).stroke();
  }

  // Cage outlines + label positions come from the shared geometry (cell-unit coords → scale to px).
  const { lines, sums } = computeCageOutline(cages, size, inset / cell);

  doc.lineWidth(1.3).dash(2.4, { space: 1.6 }).strokeColor('black');
  for (const l of lines) {
    doc.moveTo(startX + l.x1 * cell, startY + l.y1 * cell).lineTo(startX + l.x2 * cell, startY + l.y2 * cell).stroke();
  }
  doc.undash();

  // Labels, tucked into the anchor cell's top-left corner — small and slightly dimmed so they read
  // as annotations, not the answer. A tiny white pad keeps them legible over the cage line.
  const labelFont = cell * 0.2;
  doc.fontSize(labelFont);
  for (const s of sums) {
    const str = s.label;
    const x = startX + s.col * cell + 2.2;
    const y = startY + s.row * cell + 1.8;
    doc.rect(x - 0.6, y, doc.widthOfString(str) + 1.2, labelFont).fill('white');
    doc.fillColor('black').fillOpacity(0.55).text(str, x, y, { lineBreak: false });
    doc.fillOpacity(1);
  }
}

/** Draw a Killer grid — box-tileable config, cage labels are the bare sum. */
export function drawKillerGrid(
  doc: PDFKit.PDFDocument,
  puzzle: KillerPuzzle,
  startX: number,
  startY: number,
  gridDrawSize: number,
  showSolution = false,
): void {
  drawCagedGrid(doc, {
    config: getGridConfig(puzzle.gridSize),
    grid: showSolution ? puzzle.solution : puzzle.grid,
    cages: puzzle.cages.map((cage) => ({ cells: cage.cells, label: String(cage.sum) })),
    startX,
    startY,
    gridDrawSize,
  });
}

/** Draw a Keisan grid — boxless config (no box borders), cage labels are target+operator (`12+`, `3÷`). */
export function drawCalcGrid(
  doc: PDFKit.PDFDocument,
  puzzle: CalcPuzzle,
  startX: number,
  startY: number,
  gridDrawSize: number,
  showSolution = false,
): void {
  drawCagedGrid(doc, {
    config: calcGridConfig(puzzle.gridSize),
    grid: showSolution ? puzzle.solution : puzzle.grid,
    cages: puzzle.cages.map((cage) => ({
      cells: cage.cells,
      // Single-cell cages are givens (bare value). Mystery (no-op) cages hide their operator on the
      // PUZZLE page — but the ANSWER page reveals it (`showSolution`), so a printed key shows the
      // operation you had to deduce.
      label:
        cage.cells.length === 1
          ? String(cage.target)
          : cage.noOp && !showSolution
            ? String(cage.target)
            : `${cage.target}${PDF_OPERATOR_SYMBOL[cage.op]}`,
    })),
    startX,
    startY,
    gridDrawSize,
  });
}

/**
 * Render a Killer Sudoku booklet: a title page, one page per puzzle (empty grid + cages), then
 * one answer page each (filled solution + cages). Node runtime only (pdfkit).
 */
export async function generateKillerPDF(puzzles: KillerPuzzle[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const gridDrawSize = 400;

    doc.addPage();
    doc.fontSize(32).text('Killer Sudoku', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).text('No givens — the cage sums are the only clue.', { align: 'center' });

    // Navigation parity with the classic booklet (F9): bookmarks + puzzle↔answer links. The
    // outline is flat under each section — difficulty is in the page title — since this builder
    // takes a flat list rather than classic's difficulty-grouped batches.
    const puzzlesOutline = doc.outline.addItem('Puzzles');
    const answersOutline = doc.outline.addItem('Answer Keys');

    const drawPage = (p: KillerPuzzle, i: number, answer: boolean) => {
      doc.addPage();
      const title = `Killer #${i + 1} (${p.difficulty})${answer ? ' — Answer' : ''}`;
      doc.fillColor('black').fontSize(22).text(title, { align: 'center' });
      doc.moveDown(1);
      addPageNavigation(doc, answer ? answersOutline : puzzlesOutline, i, title, answer);
      const startY = doc.y;
      drawKillerGrid(doc, p, (doc.page.width - gridDrawSize) / 2, startY, gridDrawSize, answer);
      doc.y = startY + gridDrawSize + 30;
      drawCrossLink(doc, i, answer);
    };

    puzzles.forEach((p, i) => drawPage(p, i, false));
    puzzles.forEach((p, i) => drawPage(p, i, true));

    doc.end();
  });
}

/**
 * Render a Keisan (Calcudoku) booklet: a title page, one page per puzzle (empty grid + cages),
 * then one answer page each (filled solution + cages). Node runtime only (pdfkit).
 */
export async function generateCalcPDF(puzzles: CalcPuzzle[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const gridDrawSize = 400;

    doc.addPage();
    doc.fontSize(32).text('Keisan', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).text('No givens — the cage arithmetic is the only clue.', { align: 'center' });

    // Navigation parity with the classic booklet (F9) — see generateKillerPDF for the layout note.
    const puzzlesOutline = doc.outline.addItem('Puzzles');
    const answersOutline = doc.outline.addItem('Answer Keys');

    const drawPage = (p: CalcPuzzle, i: number, answer: boolean) => {
      doc.addPage();
      const title = `Keisan #${i + 1} (${p.gridSize}×${p.gridSize}, ${p.difficulty})${answer ? ' — Answer' : ''}`;
      doc.fillColor('black').fontSize(22).text(title, { align: 'center' });
      doc.moveDown(1);
      addPageNavigation(doc, answer ? answersOutline : puzzlesOutline, i, title, answer);
      const startY = doc.y;
      drawCalcGrid(doc, p, (doc.page.width - gridDrawSize) / 2, startY, gridDrawSize, answer);
      doc.y = startY + gridDrawSize + 30;
      drawCrossLink(doc, i, answer);
    };

    puzzles.forEach((p, i) => drawPage(p, i, false));
    puzzles.forEach((p, i) => drawPage(p, i, true));

    doc.end();
  });
}

/** Print shade for Kakuro's black cells — dark enough to read as "not a cell", light enough to print sums over. */
const KAKURO_BLOCK_FILL = '#c8c8c8';

/**
 * Draw a Kakuro: the (N+1)×(N+1) display grid — clue gutter as row 0 and column 0, then the
 * interior — with every black cell shaded, a diagonal through each clue cell, the **down** sum in
 * its upper-right triangle and the **across** sum in its lower-left (the print convention,
 * research gap G7), light interior lines and a heavier outer frame. Digits come from `grid` on
 * a puzzle page (empty for every puzzle today — Kakuro has no givens — but honoured like the
 * other renderers do, so a board with givens would print as it plays) and from `solution` on an
 * answer page. White vs black is `whiteMaskOf(solution)` (D3) and the clue picture is the same
 * `buildClues` the interactive board draws, so paper and screen agree.
 */
export function drawKakuroGrid(
  doc: PDFKit.PDFDocument,
  puzzle: KakuroPuzzle,
  startX: number,
  startY: number,
  gridDrawSize: number,
  showSolution: boolean,
): void {
  const size = puzzle.gridSize;
  const tracks = kakuroTracks(size);
  const cell = gridDrawSize / tracks;
  const clues = buildClues(puzzle.runs, size);
  const white = whiteMaskOf(puzzle.solution);
  // Display (r, c) → interior (r − 1, c − 1); the gutter is never white.
  const isWhite = (r: number, c: number) => r > 0 && c > 0 && white[r - 1][c - 1];

  // Blocks first (fills), then the lines and sums over them.
  for (let r = 0; r < tracks; r++) {
    for (let c = 0; c < tracks; c++) {
      if (!isWhite(r, c)) doc.rect(startX + c * cell, startY + r * cell, cell, cell).fill(KAKURO_BLOCK_FILL);
    }
  }

  // Interior lines: light, so the shaded blocks and the frame carry the structure.
  doc.strokeColor('black').lineWidth(0.5);
  for (let i = 1; i < tracks; i++) {
    doc.moveTo(startX, startY + i * cell).lineTo(startX + gridDrawSize, startY + i * cell).stroke();
    doc.moveTo(startX + i * cell, startY).lineTo(startX + i * cell, startY + gridDrawSize).stroke();
  }
  doc.lineWidth(2).rect(startX, startY, gridDrawSize, gridDrawSize).stroke();

  // Clue cells: the diagonal splits the block; down sum top-right, across sum bottom-left.
  const clueFont = cell * 0.3;
  const pad = cell * 0.08;
  doc.fillColor('black').fontSize(clueFont).lineWidth(0.8);
  for (let r = 0; r < tracks; r++) {
    for (let c = 0; c < tracks; c++) {
      const clue = clues[r * tracks + c];
      if (!clue) continue;
      const x = startX + c * cell;
      const y = startY + r * cell;
      doc.moveTo(x, y).lineTo(x + cell, y + cell).stroke();
      if (clue.down !== undefined) {
        const text = String(clue.down);
        doc.text(text, x + cell - doc.widthOfString(text) - pad, y + pad, { lineBreak: false });
      }
      if (clue.across !== undefined) {
        const text = String(clue.across);
        doc.text(text, x + pad, y + cell - doc.heightOfString(text) - pad * 0.5, { lineBreak: false });
      }
    }
  }

  const digits = showSolution ? puzzle.solution : puzzle.grid;
  doc.fontSize(cell * 0.5);
  for (let r = 1; r < tracks; r++) {
    for (let c = 1; c < tracks; c++) {
      const digit = digits[r - 1][c - 1];
      if (isWhite(r, c) && digit !== 0) drawCenteredDigit(doc, String(digit), startX + c * cell, startY + r * cell, cell);
    }
  }
}

/**
 * Render a Kakuro booklet: a title page, one page per puzzle (clues only), then one answer page
 * each (clues + solution digits). Same navigation as the other booklets. Node runtime only.
 */
export async function generateKakuroPDF(puzzles: KakuroPuzzle[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const gridDrawSize = 400;

    doc.addPage();
    doc.fontSize(32).text('Kakuro', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).text('Cross sums: each run of white cells adds up to its clue, with no digit repeated in a run.', { align: 'center' });

    // Navigation parity with the classic booklet (F9) — see generateKillerPDF for the layout note.
    const puzzlesOutline = doc.outline.addItem('Puzzles');
    const answersOutline = doc.outline.addItem('Answer Keys');

    const drawPage = (p: KakuroPuzzle, i: number, answer: boolean) => {
      doc.addPage();
      const title = `Kakuro #${i + 1} (${p.gridSize}×${p.gridSize}, ${p.difficulty})${answer ? ' — Answer' : ''}`;
      doc.fillColor('black').fontSize(22).text(title, { align: 'center' });
      doc.moveDown(1);
      addPageNavigation(doc, answer ? answersOutline : puzzlesOutline, i, title, answer);
      const startY = doc.y;
      drawKakuroGrid(doc, p, (doc.page.width - gridDrawSize) / 2, startY, gridDrawSize, answer);
      doc.y = startY + gridDrawSize + 30;
      drawCrossLink(doc, i, answer);
    };

    puzzles.forEach((p, i) => drawPage(p, i, false));
    puzzles.forEach((p, i) => drawPage(p, i, true));

    doc.end();
  });
}

/**
 * Register a puzzle/answer page in the PDF's navigation metadata (QA F9): a named destination
 * (the target the sibling page's link jumps to) plus a bookmark in the given outline section.
 *
 * Lifted out of `drawPuzzles` so all three booklet builders share one definition — classic PDFs
 * carried `/Outlines` and puzzle↔answer `/Annots` from the start, but `generateKillerPDF` and
 * `generateCalcPDF` re-created the page loop without them, and the roadmap advertises bookmarks
 * and internal links as a shipped feature of "the PDFs", not of one variant.
 */
function addPageNavigation(
  doc: PDFKit.PDFDocument,
  sectionOutline: PDFKit.PDFOutline,
  index: number,
  title: string,
  isAnswers: boolean,
): void {
  doc.addNamedDestination(isAnswers ? `ANSWER_${index}` : `PUZZLE_${index}`);
  sectionOutline.addItem(title);
}

/** The centred puzzle↔answer cross link under a grid — the other half of {@link addPageNavigation}. */
function drawCrossLink(doc: PDFKit.PDFDocument, index: number, isAnswers: boolean): void {
  const linkText = isAnswers ? 'Back to Puzzle' : 'Go to Answer Key';
  const linkTarget = isAnswers ? `PUZZLE_${index}` : `ANSWER_${index}`;

  doc.fontSize(12).fillColor('blue')
    .text(linkText, { align: 'center', goTo: linkTarget, underline: true });
  doc.fillColor('black');
}

export function drawPuzzles(
  doc: PDFKit.PDFDocument,
  grouped: Record<string, { puzzle: SudokuPuzzle, index: number }[]>,
  outlineRoot: PDFKit.PDFOutline,
  isAnswers = false,
  gridDrawSize = 400
): void {
  const parentOutline = outlineRoot.addItem(isAnswers ? 'Answer Keys' : 'Puzzles');
  const startX = (doc.page.width - gridDrawSize) / 2;

  for (const diff of ['easy', 'medium', 'hard', 'expert', 'extreme']) {
    const group = grouped[diff];
    if (group.length === 0) continue;

    const diffOutline = parentOutline.addItem(diff.charAt(0).toUpperCase() + diff.slice(1));

    group.forEach(({ puzzle, index }) => {
      doc.addPage();

      const sizeLabel = puzzle.gridSize !== 9 ? ` (${puzzle.gridSize}x${puzzle.gridSize})` : '';
      const title = `Sudoku #${index + 1}${sizeLabel} (${diff})`;
      doc.fontSize(24).text(isAnswers ? title + ' Answer' : title, { align: 'center' });
      doc.moveDown(2);

      addPageNavigation(doc, diffOutline, index, title, isAnswers);

      const startY = doc.y;
      drawGrid(doc, isAnswers ? puzzle.solution : puzzle.grid, startX, startY, gridDrawSize);

      doc.y = startY + gridDrawSize + 30;
      drawCrossLink(doc, index, isAnswers);
    });
  }
}

export async function generatePuzzlePDF(puzzles: SudokuPuzzle[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const grouped: Record<string, { puzzle: SudokuPuzzle, index: number }[]> = {
      easy: [], medium: [], hard: [], expert: [], extreme: []
    };

    puzzles.forEach((p, i) => {
      grouped[p.difficulty].push({ puzzle: p, index: i });
    });

    drawTitlePage(doc);

    const outlineRoot = doc.outline;
    
    drawPuzzles(doc, grouped, outlineRoot, false);
    drawPuzzles(doc, grouped, outlineRoot, true);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(10).text(`Page ${i + 1} of ${range.count}`,
        0,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width, lineBreak: false }
      );
      doc.page.margins.bottom = bottom;
    }

    doc.end();
  });
}
