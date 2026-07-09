import PDFDocument from 'pdfkit';
import { SudokuPuzzle } from '../puzzle-engine/sudoku';
import { getGridConfig } from '../puzzle-engine/sudoku';

export async function generatePuzzlePDF(puzzles: SudokuPuzzle[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Create a new PDF document
    // bufferPages is required to go back and add pagination later
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
    const buffers: Buffer[] = [];

    // Save all the pages to a buffer
    doc.on('data', buffers.push.bind(buffers));
    // When we're done, resolve the promise with the buffer
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    // If something goes wrong, reject the promise
    doc.on('error', reject);

    // Group puzzles by difficulty for the Outline
    const grouped: Record<string, { puzzle: SudokuPuzzle, index: number }[]> = {
      easy: [],
      medium: [],
      hard: [],
      expert: [],
      extreme: []
    };

    // Group puzzles by difficulty
    puzzles.forEach((p, i) => {
      grouped[p.difficulty].push({ puzzle: p, index: i });
    });

    // Add title page
    const titlePage = () => {
      doc.addPage();
      doc.fontSize(36).text('Sudoku Puzzle Book', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(18).text('Generated specifically for you.', { align: 'center' });
    };

    titlePage();

    // Create outline root
    const outlineRoot = doc.outline;

    // Draw a single grid of any size (4x4, 6x6, or 9x9)
    // The grid is always scaled to fill the same bounding box (gridDrawSize)
    const drawGrid = (grid: number[][], startX: number, startY: number, gridDrawSize: number) => {
      const puzzleSize = grid.length;
      const config = getGridConfig(puzzleSize as 4 | 6 | 9);
      const cellSize = gridDrawSize / puzzleSize;

      doc.lineWidth(1);

      // Set the font size once for the entire grid (60% of cell size)
      doc.fontSize(cellSize * 0.6);

      // Iterate through all the cells in the grid
      for (let i = 0; i < puzzleSize; i++) {
        for (let j = 0; j < puzzleSize; j++) {
          // Get the value of the current cell
          const val = grid[i][j];
          // If the cell is not empty, draw the value in the cell
          if (val !== 0) {
            // Get the width and height of the text
            const textWidth = doc.widthOfString(val.toString());
            const textHeight = doc.heightOfString(val.toString());
            // PDFKit's textHeight includes descender space (space below the baseline).
            // Since numbers don't use descenders, this makes them look a bit too high.
            // We add a small vertical offset (10% of text height) to visually center them.
            doc.text(
              val.toString(),
              startX + j * cellSize + (cellSize - textWidth) / 2,
              startY + i * cellSize + (cellSize - textHeight) / 2 + (textHeight * 0.1)
            );
          }
        }
      }

      // Draw grid lines (puzzleSize + 1 lines in each direction)
      for (let i = 0; i <= puzzleSize; i++) {
        // Draw thicker lines at box boundaries
        const isThickRow = i % config.boxHeight === 0;
        const isThickCol = i % config.boxWidth === 0;

        // Draw horizontal lines
        doc.lineWidth(isThickRow ? 3 : 1);
        doc.moveTo(startX, startY + i * cellSize)
          .lineTo(startX + gridDrawSize, startY + i * cellSize)
          .stroke();

        // Draw vertical lines
        doc.lineWidth(isThickCol ? 3 : 1);
        doc.moveTo(startX + i * cellSize, startY)
          .lineTo(startX + i * cellSize, startY + gridDrawSize)
          .stroke();
      }
    };

    // Grid settings (static across all pages — all grids fill this bounding box)
    const gridDrawSize = 400;
    const startX = (doc.page.width - gridDrawSize) / 2;

    // Draw all puzzles (and answers) and add them to the outline
    const drawPuzzles = (isAnswers = false) => {
      // Add 'Puzzles' or 'Answer Keys' to the outline
      const parentOutline = outlineRoot.addItem(isAnswers ? 'Answer Keys' : 'Puzzles');

      // Loop through each difficulty level
      for (const diff of ['easy', 'medium', 'hard', 'expert', 'extreme']) {
        const group = grouped[diff];
        if (group.length === 0) continue;

        // Add 'Easy', 'Medium', or 'Hard' to the outline
        const diffOutline = parentOutline.addItem(diff.charAt(0).toUpperCase() + diff.slice(1));

        // Loop through each puzzle in the group
        group.forEach(({ puzzle, index }) => {
          doc.addPage();

          // Build a descriptive title including grid size if not 9x9
          const sizeLabel = puzzle.gridSize !== 9 ? ` (${puzzle.gridSize}x${puzzle.gridSize})` : '';
          const title = `Sudoku #${index + 1}${sizeLabel} (${diff})`;
          doc.fontSize(24).text(isAnswers ? title + ' Answer' : title, { align: 'center' });
          doc.moveDown(2);

          // Add named destination to the puzzle
          const targetName = isAnswers ? `ANSWER_${index}` : `PUZZLE_${index}`;
          doc.addNamedDestination(targetName);
          diffOutline.addItem(title);

          // Draw the grid
          const startY = doc.y;

          drawGrid(isAnswers ? puzzle.solution : puzzle.grid, startX, startY, gridDrawSize);

          // Move to the bottom of the grid
          doc.y = startY + gridDrawSize + 30;

          // Link to corresponding page
          const linkText = isAnswers ? 'Back to Puzzle' : 'Go to Answer Key';
          const linkTarget = isAnswers ? `PUZZLE_${index}` : `ANSWER_${index}`;

          // Add the link to the page
          doc.fontSize(12).fillColor('blue')
            .text(linkText, { align: 'center', goTo: linkTarget, underline: true });
          doc.fillColor('black'); // reset color
        });
      }
    };

    drawPuzzles(false); // First pass: isAnswers is FALSE. Draw the blank puzzles.
    drawPuzzles(true);  // Second pass: isAnswers is TRUE. Draw the solved answer keys.

    // Add page numbers
    const range = doc.bufferedPageRange();
    // Loop through each page and add the page number 
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Temporarily disable the bottom margin to prevent auto page breaks
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Add the page number to the bottom center of the page
      doc.fontSize(10).text(`Page ${i + 1} of ${range.count}`,
        0,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width, lineBreak: false }
      );

      // Restore the bottom margin
      doc.page.margins.bottom = bottom;
    }

    doc.end();
  });
}
