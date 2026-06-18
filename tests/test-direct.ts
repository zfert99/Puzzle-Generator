import { generatePuzzlePDF } from '../lib/pdf/generator';
import { generateSudoku } from '../lib/puzzle-engine/sudoku';
import * as fs from 'fs';

/**
 * Direct Integration Test Script
 * 
 * This is a standalone script used during development to quickly test the
 * entire pipeline (Sudoku Engine -> PDFkit -> File System) without needing
 * to spin up the Next.js server or hit the API endpoint.
 * 
 * It generates two small puzzles, creates a PDF, and writes it directly
 * to the local `../output/test_direct.pdf` file so the developer can visually 
 * inspect the layout and styling.
 */
async function run() {
  try {
    // Step 1: Generate a tiny batch of test puzzles
    const puzzles = [
      generateSudoku('easy'),
      generateSudoku('medium')
    ];
    
    console.log('Puzzles generated successfully.');
    
    // Step 2: Feed the JSON puzzles into our PDF generation pipeline
    const pdfBuffer = await generatePuzzlePDF(puzzles);
    
    // Step 3: Write the binary buffer directly to the local disk
    fs.writeFileSync('../output/test_direct.pdf', pdfBuffer);
    console.log('PDF generated directly! Size:', pdfBuffer.length);
  } catch (err) {
    console.error('Error during direct PDF generation:', err);
  }
}

// Execute the test script
run();
