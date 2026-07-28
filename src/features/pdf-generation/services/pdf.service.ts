import PDFDocument from 'pdfkit';
import { SudokuPuzzle, getGridConfig, type GridSize, type GridConfig } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import { computeCageOutline, type LabeledCage } from '@/features/engine/killer/cage-geometry';
import type { CalcPuzzle, CalcOperator } from '@/features/engine/calc/calc-types';
import { calcGridConfig } from '@/features/engine/calc/calc-generator';

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

export function drawGrid(doc: PDFKit.PDFDocument, grid: number[][], startX: number, startY: number, gridDrawSize: number): void {
  const puzzleSize = grid.length;
  const config = getGridConfig(puzzleSize as GridSize);
  const cellSize = gridDrawSize / puzzleSize;

  doc.lineWidth(1);
  doc.fontSize(cellSize * 0.6);

  for (let i = 0; i < puzzleSize; i++) {
    for (let j = 0; j < puzzleSize; j++) {
      const val = grid[i][j];
      if (val !== 0) {
        const textWidth = doc.widthOfString(val.toString());
        const textHeight = doc.heightOfString(val.toString());
        doc.text(
          val.toString(),
          startX + j * cellSize + (cellSize - textWidth) / 2,
          startY + i * cellSize + (cellSize - textHeight) / 2 + (textHeight * 0.1)
        );
      }
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
      if (v === 0) continue;
      const s = String(v);
      const tw = doc.widthOfString(s);
      const th = doc.heightOfString(s);
      doc.text(s, startX + c * cell + (cell - tw) / 2, startY + r * cell + (cell - th) / 2 + th * 0.1, {
        lineBreak: false,
      });
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

    const drawPage = (p: KillerPuzzle, i: number, answer: boolean) => {
      doc.addPage();
      const title = `Killer #${i + 1} (${p.difficulty})${answer ? ' — Answer' : ''}`;
      doc.fillColor('black').fontSize(22).text(title, { align: 'center' });
      doc.moveDown(1);
      drawKillerGrid(doc, p, (doc.page.width - gridDrawSize) / 2, doc.y, gridDrawSize, answer);
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

    const drawPage = (p: CalcPuzzle, i: number, answer: boolean) => {
      doc.addPage();
      const title = `Keisan #${i + 1} (${p.gridSize}×${p.gridSize}, ${p.difficulty})${answer ? ' — Answer' : ''}`;
      doc.fillColor('black').fontSize(22).text(title, { align: 'center' });
      doc.moveDown(1);
      drawCalcGrid(doc, p, (doc.page.width - gridDrawSize) / 2, doc.y, gridDrawSize, answer);
    };

    puzzles.forEach((p, i) => drawPage(p, i, false));
    puzzles.forEach((p, i) => drawPage(p, i, true));

    doc.end();
  });
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

      const targetName = isAnswers ? `ANSWER_${index}` : `PUZZLE_${index}`;
      doc.addNamedDestination(targetName);
      diffOutline.addItem(title);

      const startY = doc.y;
      drawGrid(doc, isAnswers ? puzzle.solution : puzzle.grid, startX, startY, gridDrawSize);

      doc.y = startY + gridDrawSize + 30;

      const linkText = isAnswers ? 'Back to Puzzle' : 'Go to Answer Key';
      const linkTarget = isAnswers ? `PUZZLE_${index}` : `ANSWER_${index}`;

      doc.fontSize(12).fillColor('blue')
        .text(linkText, { align: 'center', goTo: linkTarget, underline: true });
      doc.fillColor('black');
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
