import { NextRequest, NextResponse } from 'next/server';
import { generatePuzzleBatch } from '@/features/engine/services/generation.service';
import { generatePuzzlePDF, generateKillerPDF } from '@/features/pdf-generation/services/pdf.service';
import { generateKillerBatch } from '@/features/engine/killer/killer-sudoku';
import { logger } from '@/lib/logger';

const MAX_PUZZLES = 50;

/** A downloadable-PDF response with the given filename. */
function pdfResponse(pdf: Buffer, filename: string): NextResponse {
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// Explicitly require Node.js runtime because pdfkit uses native Node APIs (fs, stream)
export const runtime = 'nodejs';

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
  const startTime = performance.now();
  try {
    let body;
    // Step 1: Safely parse the incoming JSON request body
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
    }
    
    // ---- Killer Sudoku branch (9×9, easy/medium/hard/expert) ----
    if (body?.variant === 'killer') {
      const { easy = 0, medium = 0, hard = 0, expert = 0 } = body || {};
      if (![easy, medium, hard, expert].every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)) {
        return NextResponse.json({ error: 'Killer counts (easy, medium, hard, expert) must be non-negative integers' }, { status: 400 });
      }
      const total = easy + medium + hard + expert;
      if (total === 0) {
        return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
      }
      if (total > MAX_PUZZLES) {
        return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
      }

      const puzzles = generateKillerBatch({ easy, medium, hard, expert });
      const pdfBuffer = await generateKillerPDF(puzzles);
      logger.info(
        { event: 'generation_success', variant: 'killer', counts: { easy, medium, hard, expert }, durationMs: Math.round(performance.now() - startTime) },
        'Successfully generated Killer puzzles and PDF',
      );
      return pdfResponse(pdfBuffer, 'Killer_Sudoku.pdf');
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
    if (easy + medium + hard + expert + extreme > MAX_PUZZLES) {
      return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
    }

    // ==========================================
    // PUZZLE GENERATION
    // ==========================================
    
    // Delegate the synchronous puzzle generation loops to the engine service
    const puzzles = generatePuzzleBatch({ easy, medium, hard, expert, extreme, gridSize });


    // ==========================================
    // PDF GENERATION AND RESPONSE
    // ==========================================

    // Pass the array of generated puzzles to the PDF generator
    const pdfBuffer = await generatePuzzlePDF(puzzles);

    logger.info(
      { 
        event: 'generation_success', 
        counts: { easy, medium, hard, expert, extreme }, 
        gridSize, 
        durationMs: Math.round(performance.now() - startTime) 
      }, 
      'Successfully generated puzzles and PDF'
    );

    // Return the generated PDF buffer directly as the HTTP response body
    return pdfResponse(pdfBuffer, 'Sudoku_Puzzles.pdf');
  } catch (error: unknown) {
    // If anything fails during puzzle generation or PDF rendering, catch it here
    const err = error as Error;
    logger.error(
      { 
        event: 'generation_failure', 
        error: err.message, 
        stack: err.stack,
        durationMs: Math.round(performance.now() - startTime)
      }, 
      'Failed to generate PDF'
    );
    
    // Return a generic 500 to the client. The full error message and stack are
    // captured server-side by logger.error above; leaking them in the HTTP
    // response is an information-disclosure weakness (OWASP Security
    // Misconfiguration) — see AGENTS.md Section 6.
    return NextResponse.json({
      error: 'Internal server error during PDF generation',
    }, { status: 500 });
  }
}
