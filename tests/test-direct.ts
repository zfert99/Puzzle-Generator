import { generatePuzzlePDF } from './lib/pdf/generator';
import { generateSudoku } from './lib/puzzle-engine/sudoku';
import * as fs from 'fs';

async function run() {
  try {
    const puzzles = [
      generateSudoku('easy'),
      generateSudoku('medium')
    ];
    
    console.log('Puzzles generated successfully.');
    
    const pdfBuffer = await generatePuzzlePDF(puzzles);
    
    fs.writeFileSync('../output/test_direct.pdf', pdfBuffer);
    console.log('PDF generated directly! Size:', pdfBuffer.length);
  } catch (err) {
    console.error('Error during direct PDF generation:', err);
  }
}

run();
