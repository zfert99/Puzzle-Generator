import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePuzzleBatch } from '@/features/engine/services/generation.service';
import { generatePuzzlePDF, generateKillerPDF, generateCalcPDF, generateKakuroPDF, generateSkyscrapersPDF } from '@/features/pdf-generation/services/pdf.service';
import { generateKillerBatch } from '@/features/engine/killer/killer-sudoku';
import { generateCalcBatch } from '@/features/engine/calc/calc-sudoku';
import { generateKakuroBatch, isKakuroBudgetError } from '@/features/engine/kakuro/kakuro';
import { KAKURO_LADDER, type KakuroLevel } from '@/features/engine/kakuro/kakuro-types';
import { SKYSCRAPERS_LADDER, type SkyscrapersLevel } from '@/features/engine/skyscrapers/skyscrapers-types';
import { generateSkyscrapersBatch, isSkyscrapersBudgetError, isSkyscrapersLevelOffered, SKYSCRAPERS_TIERS_BY_SIZE } from '@/features/engine/skyscrapers/skyscrapers';
import { logger } from '@/lib/logger';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const MAX_PUZZLES = 50;
// Extreme puzzles are the slow path across every variant — Killer Extreme ≈ 5.5 s each, classic
// Extreme digs ≈ 0.9 s each (full-solution regen, up to 50 retries), and 9×9 Keisan Extreme runs
// the tier-5/6 bounded-recursion solver. The total-count cap (50) isn't enough on its own: 50
// Extreme of any variant blows the `maxDuration = 60` budget and 504s. Cap the Extreme sub-count so
// no single request can exceed the function duration. Applied to all three variant branches below.
const MAX_EXTREME = 5;

/**
 * Kakuro request shape (plan slices V3 → E5). Sizes are Kakuro's own (D11), not the Sudoku
 * family's 4/6/9; counts are non-negative integers, with the same total and Extreme caps as the
 * other variants applied below (a 9×9 Kakuro generates in ~0.3–0.8 s per tier, extreme the
 * slowest).
 */
const kakuroCount = z.number().int().min(0, 'Kakuro counts must be non-negative integers').default(0);
const kakuroRequestSchema = z.object({
  variant: z.literal('kakuro'),
  gridSize: z.union([z.literal(6), z.literal(7), z.literal(9)], { error: 'Kakuro grid size must be 6, 7, or 9' }).default(7),
  easy: kakuroCount,
  medium: kakuroCount,
  hard: kakuroCount,
  expert: kakuroCount,
  extreme: kakuroCount,
});

/**
 * Skyscrapers request shape (plan slices V3 → E5). Sizes are Skyscrapers' own (D4: 5 / 6 / 7);
 * counts are non-negative integers. Which levels a size offers (D12) is checked after parsing
 * against `SKYSCRAPERS_TIERS_BY_SIZE` — a count on a level the size does not offer is a 400 with
 * the offered list, never a silently substituted puzzle.
 */
const skyscrapersCount = z.number().int().min(0, 'Skyscrapers counts must be non-negative integers').default(0);
const skyscrapersRequestSchema = z.object({
  variant: z.literal('skyscrapers'),
  gridSize: z.union([z.literal(5), z.literal(6), z.literal(7)], { error: 'Skyscrapers grid size must be 5, 6, or 7' }).default(6),
  easy: skyscrapersCount,
  medium: skyscrapersCount,
  hard: skyscrapersCount,
  expert: skyscrapersCount,
  extreme: skyscrapersCount,
});

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
// Killer extreme ≈ 5.5 s per puzzle; classic extreme diggers are also slow — give the batch room.
export const maxDuration = 60;

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
 * With `"variant": "killer" | "calc" | "kakuro" | "skyscrapers"` the same counts select that
 * type's puzzles (Kakuro: `gridSize` 6 | 7 | 9; Skyscrapers: `gridSize` 5 | 6 | 7, exactly one
 * puzzle per request until E5 — see `skyscrapersRequestSchema`).
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();
  try {
    // Per-IP throttle: this route runs the CPU-heavy generator + PDF render with maxDuration=60 and
    // takes no auth, so it's the prime DoS/cost target (review finding H1). 10 req/min per IP.
    const rl = await rateLimit(`generate:${clientIp(req)}`, { max: 10, windowSec: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: rl.retryAfter ? { 'Retry-After': String(rl.retryAfter) } : undefined },
      );
    }

    let body;
    // Step 1: Safely parse the incoming JSON request body
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
    }
    
    // ---- Killer Sudoku branch (9×9, easy/medium/hard/expert/extreme) ----
    if (body?.variant === 'killer') {
      const { easy = 0, medium = 0, hard = 0, expert = 0, extreme = 0, gridSize: killerSize = 9 } = body || {};
      if (killerSize !== 9 && killerSize !== 6) {
        return NextResponse.json({ error: 'Killer grid size must be 6 or 9' }, { status: 400 });
      }
      if (killerSize === 6 && (expert > 0 || extreme > 0)) {
        return NextResponse.json({ error: '6×6 Killer supports easy, medium, and hard only' }, { status: 400 });
      }
      if (![easy, medium, hard, expert, extreme].every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)) {
        return NextResponse.json({ error: 'Killer counts (easy, medium, hard, expert, extreme) must be non-negative integers' }, { status: 400 });
      }
      // Extreme generates in ~5.5 s each (tier-5-necessary layouts are rare); cap the count so
      // a PDF request stays inside the function duration budget.
      if (extreme > MAX_EXTREME) {
        return NextResponse.json({ error: `At most ${MAX_EXTREME} extreme Killer puzzles per PDF request` }, { status: 400 });
      }
      const total = easy + medium + hard + expert + extreme;
      if (total === 0) {
        return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
      }
      if (total > MAX_PUZZLES) {
        return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
      }

      const puzzles = generateKillerBatch({ easy, medium, hard, expert, extreme }, { gridSize: killerSize });
      const pdfBuffer = await generateKillerPDF(puzzles);
      logger.info(
        { event: 'generation_success', variant: 'killer', counts: { easy, medium, hard, expert, extreme }, durationMs: Math.round(performance.now() - startTime) },
        'Successfully generated Killer puzzles and PDF',
      );
      return pdfResponse(pdfBuffer, 'Killer_Sudoku.pdf');
    }

    // ---- Keisan (Calcudoku) branch (4×4 / 6×6 easy/medium/hard; 9×9 adds expert + extreme) ----
    if (body?.variant === 'calc') {
      const { easy = 0, medium = 0, hard = 0, expert = 0, extreme = 0, gridSize: calcSize = 6 } = body || {};
      if (calcSize !== 4 && calcSize !== 6 && calcSize !== 9) {
        return NextResponse.json({ error: 'Keisan grid size must be 4, 6, or 9' }, { status: 400 });
      }
      if (![easy, medium, hard, expert, extreme].every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)) {
        return NextResponse.json({ error: 'Keisan counts (easy, medium, hard, expert, extreme) must be non-negative integers' }, { status: 400 });
      }
      if ((expert > 0 || extreme > 0) && calcSize !== 9) {
        return NextResponse.json({ error: 'Expert and Extreme Keisan are only available at 9×9' }, { status: 400 });
      }
      // 9×9 Keisan Extreme runs the tier-5/6 recursion solver; cap the sub-count so a batch stays
      // inside the function duration budget (the total cap alone allows 50 Extreme → timeout).
      if (extreme > MAX_EXTREME) {
        return NextResponse.json({ error: `At most ${MAX_EXTREME} extreme Keisan puzzles per PDF request` }, { status: 400 });
      }
      const total = easy + medium + hard + expert + extreme;
      if (total === 0) {
        return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
      }
      if (total > MAX_PUZZLES) {
        return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
      }

      const noOp = body?.noOp === true; // Mystery mode: hide operators
      const puzzles = generateCalcBatch({ easy, medium, hard, expert, extreme }, { gridSize: calcSize, noOp });
      const pdfBuffer = await generateCalcPDF(puzzles);
      logger.info(
        { event: 'generation_success', variant: 'calc', counts: { easy, medium, hard, expert, extreme }, gridSize: calcSize, noOp, durationMs: Math.round(performance.now() - startTime) },
        'Successfully generated Keisan puzzles and PDF',
      );
      return pdfResponse(pdfBuffer, 'Keisan.pdf');
    }

    // ---- Kakuro branch (6×6 / 7×7 / 9×9, the full ladder at every size — generated, E5) ----
    if (body?.variant === 'kakuro') {
      const parsed = kakuroRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid Kakuro request' }, { status: 400 });
      }
      const kakuroSize = parsed.data.gridSize;
      const counts = Object.fromEntries(KAKURO_LADDER.map((level) => [level, parsed.data[level]])) as Record<KakuroLevel, number>;
      const kakuroTotal = KAKURO_LADDER.reduce((sum, level) => sum + counts[level], 0);
      if (kakuroTotal === 0) {
        return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
      }
      if (kakuroTotal > MAX_PUZZLES) {
        return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
      }
      if (counts.extreme > MAX_EXTREME) {
        return NextResponse.json({ error: `At most ${MAX_EXTREME} extreme Kakuro puzzles per PDF request` }, { status: 400 });
      }
      // One budget for the batch (default 45 s inside `maxDuration = 60`): a request that cannot
      // finish is answered with a 503 that says so — it is a request too large for the budget on
      // this machine, not a fault — instead of timing out with the PDF half-built.
      let puzzles;
      try {
        puzzles = generateKakuroBatch(counts, { gridSize: kakuroSize });
      } catch (error) {
        if (!isKakuroBudgetError(error)) throw error;
        logger.warn({ event: 'generation_budget', variant: 'kakuro', counts, gridSize: kakuroSize, durationMs: Math.round(performance.now() - startTime) }, error.message);
        return NextResponse.json(
          { error: `That Kakuro request is too large to finish in time (${error.message.match(/after (\d+ of \d+)/)?.[1] ?? 'none'} generated). Please ask for fewer puzzles per PDF.` },
          { status: 503, headers: { 'Retry-After': '5' } },
        );
      }
      const pdfBuffer = await generateKakuroPDF(puzzles);
      logger.info(
        { event: 'generation_success', variant: 'kakuro', counts, gridSize: kakuroSize, durationMs: Math.round(performance.now() - startTime) },
        'Successfully generated Kakuro puzzles and PDF',
      );
      return pdfResponse(pdfBuffer, 'Kakuro.pdf');
    }

    // ---- Skyscrapers branch (5×5 / 6×6 / 7×7, the tiers each size offers — generated, E5) ----
    if (body?.variant === 'skyscrapers') {
      const parsed = skyscrapersRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid Skyscrapers request' }, { status: 400 });
      }
      const skySize = parsed.data.gridSize;
      const counts = Object.fromEntries(SKYSCRAPERS_LADDER.map((level) => [level, parsed.data[level]])) as Record<SkyscrapersLevel, number>;
      const skyTotal = SKYSCRAPERS_LADDER.reduce((sum, level) => sum + counts[level], 0);
      if (skyTotal === 0) {
        return NextResponse.json({ error: 'Please select at least one puzzle to generate' }, { status: 400 });
      }
      if (skyTotal > MAX_PUZZLES) {
        return NextResponse.json({ error: `Too many puzzles requested. Maximum is ${MAX_PUZZLES} per request.` }, { status: 400 });
      }
      const notOffered = SKYSCRAPERS_LADDER.find((level) => counts[level] > 0 && !isSkyscrapersLevelOffered(skySize, level));
      if (notOffered) {
        return NextResponse.json({ error: `${skySize}×${skySize} Skyscrapers offers ${SKYSCRAPERS_TIERS_BY_SIZE[skySize].join(', ')} — not ${notOffered}` }, { status: 400 });
      }
      // One budget for the batch (default 45 s inside `maxDuration = 60`), the Kakuro contract: a
      // request that cannot finish is a 503 that says so, not a PDF half-built at the timeout.
      let puzzles;
      try {
        puzzles = generateSkyscrapersBatch(counts, { gridSize: skySize });
      } catch (error) {
        if (!isSkyscrapersBudgetError(error)) throw error;
        logger.warn({ event: 'generation_budget', variant: 'skyscrapers', counts, gridSize: skySize, durationMs: Math.round(performance.now() - startTime) }, error.message);
        return NextResponse.json(
          { error: `That Skyscrapers request is too large to finish in time (${error.message.match(/after (\d+ of \d+)/)?.[1] ?? 'none'} generated). Please ask for fewer puzzles per PDF.` },
          { status: 503, headers: { 'Retry-After': '5' } },
        );
      }
      const pdfBuffer = await generateSkyscrapersPDF(puzzles);
      logger.info(
        { event: 'generation_success', variant: 'skyscrapers', counts, gridSize: skySize, durationMs: Math.round(performance.now() - startTime) },
        'Successfully generated Skyscrapers puzzles and PDF',
      );
      return pdfResponse(pdfBuffer, 'Skyscrapers.pdf');
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

    // Classic Extreme digs ~0.9 s each (full-solution regen, up to 50 retries); cap the sub-count
    // so a batch stays inside the function duration budget (the total cap alone allows 50 Extreme).
    if (extreme > MAX_EXTREME) {
      return NextResponse.json({ error: `At most ${MAX_EXTREME} extreme puzzles per PDF request` }, { status: 400 });
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
