import PDFDocument from 'pdfkit';
import { SudokuPuzzle } from '../puzzle-engine/sudoku';
import { Writable } from 'stream';

export async function generatePuzzlePDF(puzzles: SudokuPuzzle[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // bufferPages is required to go back and add pagination later
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
    const buffers: Buffer[] = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Group puzzles by difficulty for the Outline
    const grouped: Record<string, { puzzle: SudokuPuzzle, index: number }[]> = {
      easy: [],
      medium: [],
      hard: []
    };
    
    puzzles.forEach((p, i) => {
      grouped[p.difficulty].push({ puzzle: p, index: i });
    });

    const titlePage = () => {
      doc.addPage();
      doc.fontSize(36).text('Sudoku Puzzle Book', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(18).text('Generated specifically for you.', { align: 'center' });
    };

    titlePage();
    
    // Create outline root
    const outlineRoot = doc.outline;

    // Draw a single 9x9 grid
    const drawGrid = (grid: number[][], startX: number, startY: number, size: number) => {
      const cellSize = size / 9;
      
      doc.lineWidth(1);
      
      // Draw numbers in the grid
      // Iterate through all the cells in the grid
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          // Get the value of the current cell
          const val = grid[i][j];
          // If the cell is not empty, draw the value in the cell
          if (val !== 0) {
            // Set the font size to be 60% of the cell size
            doc.fontSize(cellSize * 0.6);
            // Get the width and height of the text
            const textWidth = doc.widthOfString(val.toString());
            const textHeight = doc.heightOfString(val.toString());
            // Draw the text in the center of the cell
            doc.text(
              val.toString(),
              startX + j * cellSize + (cellSize - textWidth) / 2,
              startY + i * cellSize + (cellSize - textHeight) / 2
            );
          }
        }
      }

      // Draw 10 grid lines (horizontal and vertical)
      for (let i = 0; i <= 9; i++) {
        // Draw thicker lines every 3rd line to create 3x3 subgrids
        doc.lineWidth(i % 3 === 0 ? 3 : 1);
        
        // Draw horizontal lines
        doc.moveTo(startX, startY + i * cellSize)
           .lineTo(startX + size, startY + i * cellSize)
           .stroke();
           
        // Draw vertical lines
        doc.moveTo(startX + i * cellSize, startY)
           .lineTo(startX + i * cellSize, startY + size)
           .stroke();
      }
    };

    const drawPuzzles = (isAnswers = false) => {
      const parentOutline = outlineRoot.addItem(isAnswers ? 'Answer Keys' : 'Puzzles');
      let puzzleCount = 0;
      
      for (const diff of ['easy', 'medium', 'hard']) {
        const group = grouped[diff];
        if (group.length === 0) continue;
        
        const diffOutline = parentOutline.addItem(diff.charAt(0).toUpperCase() + diff.slice(1));
        
        group.forEach(({ puzzle, index }) => {
          puzzleCount++;
          doc.addPage();
          
          const title = `Sudoku #${index + 1} (${diff})`;
          doc.fontSize(24).text(isAnswers ? title + ' Answer' : title, { align: 'center' });
          doc.moveDown(2);
          
          const targetName = isAnswers ? `ANSWER_${index}` : `PUZZLE_${index}`;
          doc.addNamedDestination(targetName);
          diffOutline.addItem(title);
          
          const gridSize = 400;
          const startX = (doc.page.width - gridSize) / 2;
          const startY = doc.y;
          
          drawGrid(isAnswers ? puzzle.solution : puzzle.grid, startX, startY, gridSize);
          
          doc.y = startY + gridSize + 30;
          
          // Link to corresponding page
          const linkText = isAnswers ? 'Back to Puzzle' : 'Go to Answer Key';
          const linkTarget = isAnswers ? `PUZZLE_${index}` : `ANSWER_${index}`;
          
          doc.fontSize(12).fillColor('blue')
            .text(linkText, { align: 'center', goTo: linkTarget, underline: true });
          doc.fillColor('black'); // reset color
        });
      }
    };

    drawPuzzles(false); // Draw puzzles
    drawPuzzles(true);  // Draw answers
    
    // Add page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(10).text(`Page ${i + 1} of ${range.count}`, 
        0, 
        doc.page.height - 30, 
        { align: 'center', width: doc.page.width }
      );
    }
    
    doc.end();
  });
}
