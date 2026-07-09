import { NextRequest, NextResponse } from 'next/server';
import { generateSudoku, Difficulty, GridSize } from '@/lib/puzzle-engine/sudoku';
import { generatePuzzlePDF } from '@/lib/pdf/generator';

/**
 * POST /api/generate
 * API Route Handler for generating Sudoku puzzles and returning them as a downloadable PDF.
 * 
 * Expected JSON Body:
 * {
 *   "easy": number,      // Number of easy puzzles to generate
 *   "medium": number,    // Number of medium puzzles to generate
 *   "hard": number,      // Number of hard puzzles to generate
 *   "expert": number,    // Number of expert puzzles to generate
 *   "extreme": number,   // Number of extreme puzzles to generate
 *   "gridSize": 4 | 6 | 9  // Optional, defaults to 9
 * }
 */
export async function POST(req: NextRequest) {
  try {
    let body;
    // Step 1: Safely parse the incoming JSON request body
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
    }
    
    // Extract puzzle counts, defaulting to 0 if not provided
    const { easy = 0, medium = 0, hard = 0, expert = 0, extreme = 0, gridSize = 9 } = body || {};

    // ==========================================
    // VALIDATION
    // ==========================================

    // Ensure that all provided values are strictly numbers
    if (typeof easy !== 'number' || typeof medium !== 'number' || typeof hard !== 'number' || typeof expert !== 'number' || typeof extreme !== 'number') {
      return NextResponse.json({ error: 'Invalid input: easy, medium, hard, expert, and extreme must be numbers' }, { status: 400 });
    }

    // Ensure that all provided values are non-negative integers (no decimals, no negative amounts)
    if (easy < 0 || medium < 0 || hard < 0 || expert < 0 || extreme < 0 || !Number.isInteger(easy) || !Number.isInteger(medium) || !Number.isInteger(hard) || !Number.isInteger(expert) || !Number.isInteger(extreme)) {
      return NextResponse.json({ error: 'Invalid input: values must be non-negative integers' }, { status: 400 });
    }

    // Validate gridSize
    if (![4, 6, 9].includes(gridSize)) {
      return NextResponse.json({ error: 'Invalid gridSize: must be 4, 6, or 9' }, { status: 400 });
    }

    // Validate difficulty restrictions for mini grids
    if (gridSize !== 9 && (expert > 0 || extreme > 0)) {
      return NextResponse.json({ error: `Expert and Extreme difficulties are only available for 9x9 grids` }, { status: 400 });
    }

    // Ensure the user requested at least one puzzle
    if (easy === 0 && medium === 0 && hard === 0 && expert === 0 && extreme === 0) {
      return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
    }

    // Security/Performance measure: Enforce a maximum total puzzle limit to prevent server timeouts or DoS attacks
    const MAX_PUZZLES = 50;
    if (easy + medium + hard + expert + extreme > MAX_PUZZLES) {
      return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
    }

    // ==========================================
    // PUZZLE GENERATION
    // ==========================================
    
    const puzzles = [];
    const size = gridSize as GridSize;

    // Generate Easy puzzles synchronously
    for (let i = 0; i < easy; i++) {
      puzzles.push(generateSudoku('easy', size));
    }

    // Generate Medium puzzles synchronously
    for (let i = 0; i < medium; i++) {
      puzzles.push(generateSudoku('medium', size));
    }

    // Generate Hard puzzles synchronously
    for (let i = 0; i < hard; i++) {
      puzzles.push(generateSudoku('hard', size));
    }

    // Generate Expert puzzles synchronously (this uses the advanced HumanSolver logic)
    for (let i = 0; i < expert; i++) {
      puzzles.push(generateSudoku('expert', size));
    }

    // Generate Extreme puzzles synchronously (uses extreme HumanSolver strategies)
    for (let i = 0; i < extreme; i++) {
      puzzles.push(generateSudoku('extreme', size));
    }

    // ==========================================
    // PDF GENERATION AND RESPONSE
    // ==========================================

    // Pass the array of generated puzzles to the PDF generator
    const pdfBuffer = await generatePuzzlePDF(puzzles);

    // Return the generated PDF buffer directly as the HTTP response body
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        // Content-Type tells the browser this is a binary PDF file
        'Content-Type': 'application/pdf',
        // Content-Disposition 'attachment' forces the browser to download the file rather than trying to display it inline
        'Content-Disposition': 'attachment; filename="Sudoku_Puzzles.pdf"',
      },
    });
  } catch (error: unknown) {
    // If anything fails during puzzle generation or PDF rendering, catch it here
    const err = error as Error;
    console.error('Failed to generate PDF:', err);
    
    // Return a 500 Internal Server Error with details
    return NextResponse.json({
      error: 'Internal server error during PDF generation',
      details: err.message,
      stack: err.stack
    }, { status: 500 });
  }
}
