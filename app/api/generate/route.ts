import { NextRequest, NextResponse } from 'next/server';
import { generateSudoku, Difficulty } from '@/lib/puzzle-engine/sudoku';
import { generatePuzzlePDF } from '@/lib/pdf/generator';

export async function POST(req: NextRequest) {
  try {
    const { easy = 0, medium = 0, hard = 0 } = await req.json();
    
    if (easy === 0 && medium === 0 && hard === 0) {
      return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
    }
    
    const puzzles = [];
    
    // Generate Easy
    for (let i = 0; i < easy; i++) {
      puzzles.push(generateSudoku('easy'));
    }
    
    // Generate Medium
    for (let i = 0; i < medium; i++) {
      puzzles.push(generateSudoku('medium'));
    }
    
    // Generate Hard
    for (let i = 0; i < hard; i++) {
      puzzles.push(generateSudoku('hard'));
    }
    
    const pdfBuffer = await generatePuzzlePDF(puzzles);
    
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Sudoku_Puzzles.pdf"',
      },
    });
  } catch (error: any) {
    console.error('Failed to generate PDF:', error);
    return NextResponse.json({ 
      error: 'Internal server error during PDF generation', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
