import { NextRequest, NextResponse } from 'next/server';
import { generateSudoku, Difficulty } from '@/lib/puzzle-engine/sudoku';
import { generatePuzzlePDF } from '@/lib/pdf/generator';

export async function POST(req: NextRequest) {
  try {
    // Get the number of puzzles to generate from the request body
    const { easy = 0, medium = 0, hard = 0 } = await req.json();

    // Validate that all values are numbers
    if (typeof easy !== 'number' || typeof medium !== 'number' || typeof hard !== 'number') {
      return NextResponse.json({ error: 'Invalid input: easy, medium, and hard must be numbers' }, { status: 400 });
    }

    // Validate that all values are non-negative integers
    if (easy < 0 || medium < 0 || hard < 0 || !Number.isInteger(easy) || !Number.isInteger(medium) || !Number.isInteger(hard)) {
      return NextResponse.json({ error: 'Invalid input: values must be non-negative integers' }, { status: 400 });
    }

    // If no puzzles are selected, return an error
    if (easy === 0 && medium === 0 && hard === 0) {
      return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
    }

    // Enforce a maximum limit to prevent server overload
    const MAX_PUZZLES = 50;
    if (easy + medium + hard > MAX_PUZZLES) {
      return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
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

    // Generate the PDF
    const pdfBuffer = await generatePuzzlePDF(puzzles);

    // Return the PDF as a response
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      // Tell the browser that the response is a PDF file and should be downloaded as a file named Sudoku_Puzzles.pdf
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Sudoku_Puzzles.pdf"',
      },
    });
  } catch (error: any) {
    // Log the error
    console.error('Failed to generate PDF:', error);
    // Return an error response
    return NextResponse.json({
      error: 'Internal server error during PDF generation',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
