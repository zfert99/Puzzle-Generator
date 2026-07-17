/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import { SudokuPuzzle, getGridConfig } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import { computeCageOutline } from '@/features/engine/killer/cage-geometry';

export function drawTitlePage(doc: any): void {
  doc.addPage();
  doc.fontSize(36).text('Sudoku Puzzle Book', { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(18).text('Generated specifically for you.', { align: 'center' });
}

export function drawGrid(doc: any, grid: number[][], startX: number, startY: number, gridDrawSize: number): void {
  const puzzleSize = grid.length;
  const config = getGridConfig(puzzleSize as 4 | 6 | 9);
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

  for (let i = 0; i <= puzzleSize; i++) {
    const isThickRow = i % config.boxHeight === 0;
    const isThickCol = i % config.boxWidth === 0;

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
 * Draw a Killer Sudoku grid: the base grid + digits (empty for a puzzle, the solution for an
 * answer), plus the two Killer-specific marks — dashed cage outlines (drawn inset on every edge
 * where the neighbouring cell belongs to a different cage) and the cage's sum in the top-left
 * corner of its anchor cell (its lowest-indexed cell). A small white pad behind the sum keeps it
 * legible over the dashed border.
 */
export function drawKillerGrid(
  doc: any,
  puzzle: KillerPuzzle,
  startX: number,
  startY: number,
  gridDrawSize: number,
  showSolution = false,
): void {
  const size = puzzle.gridSize;
  const config = getGridConfig(size);
  const cell = gridDrawSize / size;
  const inset = cell * 0.09;

  // Digits (solution on an answer page; nothing on the puzzle page — Killer has no givens).
  const grid = showSolution ? puzzle.solution : puzzle.grid;
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

  // Base grid: thin cell lines, thick box lines.
  doc.strokeColor('black');
  for (let i = 0; i <= size; i++) {
    doc.lineWidth(i % config.boxHeight === 0 ? 2 : 0.5);
    doc.moveTo(startX, startY + i * cell).lineTo(startX + gridDrawSize, startY + i * cell).stroke();
    doc.lineWidth(i % config.boxWidth === 0 ? 2 : 0.5);
    doc.moveTo(startX + i * cell, startY).lineTo(startX + i * cell, startY + gridDrawSize).stroke();
  }

  // Cage outlines + sum positions come from the shared geometry (cell-unit coords → scale to px).
  // The inner/outer corner logic lives in `computeCageOutline`; here we just stroke the result.
  const { lines, sums } = computeCageOutline(puzzle.cages, size, inset / cell);

  doc.lineWidth(1.3).dash(2.4, { space: 1.6 }).strokeColor('black');
  for (const l of lines) {
    doc.moveTo(startX + l.x1 * cell, startY + l.y1 * cell).lineTo(startX + l.x2 * cell, startY + l.y2 * cell).stroke();
  }
  doc.undash();

  // Cage sums, tucked into the anchor cell's top-left corner — small and slightly dimmed so they
  // read as annotations, not the answer. A tiny white pad keeps them legible over the cage line.
  const sumFont = cell * 0.2;
  doc.fontSize(sumFont);
  for (const s of sums) {
    const str = String(s.value);
    const x = startX + s.col * cell + 2.2;
    const y = startY + s.row * cell + 1.8;
    doc.rect(x - 0.6, y, doc.widthOfString(str) + 1.2, sumFont).fill('white');
    doc.fillColor('black').fillOpacity(0.55).text(str, x, y, { lineBreak: false });
    doc.fillOpacity(1);
  }
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

export function drawPuzzles(
  doc: any, 
  grouped: Record<string, { puzzle: SudokuPuzzle, index: number }[]>, 
  outlineRoot: any, 
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
