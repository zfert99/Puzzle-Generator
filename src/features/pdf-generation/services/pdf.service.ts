/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';
import { SudokuPuzzle, getGridConfig } from '@/features/engine/sudoku';

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
