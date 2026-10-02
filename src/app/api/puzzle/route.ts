import { NextRequest, NextResponse } from 'next/server';
import { generateSinglePuzzle } from '@/features/engine/services/generation.service';
import { generateKillerSudoku, type KillerDifficulty } from '@/features/engine/killer/killer-sudoku';
import { generateCalcSudoku } from '@/features/engine/calc/calc-sudoku';
import type { CalcDifficulty } from '@/features/engine/calc/calc-types';
import { generateKakuro, KAKURO_SIZES, type KakuroSize } from '@/features/engine/kakuro/kakuro';
import { KAKURO_LADDER, type KakuroLevel } from '@/features/engine/kakuro/kakuro-types';
import { generateSkyscrapersDetailed } from '@/features/engine/skyscrapers/skyscrapers';
import { SKYSCRAPERS_LADDER, SKYSCRAPERS_SIZES, SKYSCRAPERS_TIERS_BY_SIZE, isSkyscrapersLevelOffered, type SkyscrapersLevel, type SkyscrapersSize } from '@/features/engine/skyscrapers/skyscrapers-types';
import { Difficulty, GridSize } from '@/features/engine/sudoku';
import { logger } from '@/lib/logger';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const KILLER_DIFFICULTIES: KillerDifficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];
const CALC_DIFFICULTIES: CalcDifficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];

// The engine is pure TypeScript, but keep this on the Node.js runtime for
// consistency with the rest of the API and to leave room for future Node-only work.
export const runtime = 'nodejs';
// Killer extreme generates in ~5.5 s avg / ~10 s max (tier-5-necessary layouts are rare by
// nature) — the platform default duration cap would intermittently 504 it.
export const maxDuration = 60;

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];
const VALID_GRID_SIZES: GridSize[] = [4, 6, 9];

/**
 * POST /api/puzzle
 * Generates a single playable Sudoku puzzle for the interactive board and returns
 * it as JSON. Running generation server-side keeps the heavy solver/generator out
 * of the client bundle and off the browser's main thread (protecting INP).
 *
 * Expected JSON body:
 * {
 *   "difficulty": "easy" | "medium" | "hard" | "expert" | "extreme",
 *   "gridSize": 4 | 6 | 9   // optional, defaults to 9
 * }
 *
 * Response: { grid, solution, difficulty, gridSize }
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();
  try {
    // Per-IP throttle: unauth server-side generation with maxDuration=60 (review finding H1). One
    // puzzle per game means 30 req/min is generous headroom for a real player, tight for an abuser.
    const rl = await rateLimit(`puzzle:${clientIp(req)}`, { max: 30, windowSec: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: rl.retryAfter ? { 'Retry-After': String(rl.retryAfter) } : undefined },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
    }

    const { difficulty, gridSize = 9, variant = 'classic' } = body || {};

    // ---- Killer branch (9×9 full ladder, or 6×6 easy/medium/hard) ----
    if (variant === 'killer') {
      if (!KILLER_DIFFICULTIES.includes(difficulty)) {
        return NextResponse.json({ error: 'Killer difficulty must be easy, medium, hard, expert, or extreme' }, { status: 400 });
      }
      if (gridSize !== 9 && gridSize !== 6) {
        return NextResponse.json({ error: 'Killer grid size must be 6 or 9' }, { status: 400 });
      }
      if (gridSize === 6 && (difficulty === 'expert' || difficulty === 'extreme')) {
        return NextResponse.json({ error: '6×6 Killer supports easy, medium, or hard' }, { status: 400 });
      }
      const puzzle = generateKillerSudoku(difficulty as KillerDifficulty, { gridSize });
      logger.info(
        { event: 'puzzle_success', variant: 'killer', difficulty, durationMs: Math.round(performance.now() - startTime) },
        'Generated interactive Killer puzzle',
      );
      return NextResponse.json(puzzle, { status: 200 });
    }

    // ---- Keisan branch (Calcudoku; 4×4/6×6 easy/medium/hard, 9×9 adds expert) ----
    if (variant === 'calc') {
      if (!CALC_DIFFICULTIES.includes(difficulty)) {
        return NextResponse.json({ error: 'Keisan difficulty must be easy, medium, hard, expert, or extreme' }, { status: 400 });
      }
      if (gridSize !== 4 && gridSize !== 6 && gridSize !== 9) {
        return NextResponse.json({ error: 'Keisan grid size must be 4, 6, or 9' }, { status: 400 });
      }
      if ((difficulty === 'expert' || difficulty === 'extreme') && gridSize !== 9) {
        return NextResponse.json({ error: 'Expert and Extreme Keisan are only available at 9×9' }, { status: 400 });
      }
      const noOp = body?.noOp === true; // Mystery mode: hide operators (orthogonal to size/difficulty)
      const puzzle = generateCalcSudoku(difficulty as CalcDifficulty, { gridSize, noOp });
      logger.info(
        { event: 'puzzle_success', variant: 'calc', difficulty, gridSize, noOp, durationMs: Math.round(performance.now() - startTime) },
        'Generated interactive Keisan puzzle',
      );
      return NextResponse.json(puzzle, { status: 200 });
    }

    // ---- Kakuro branch (6×6 / 7×7 / 9×9, the full ladder at every size — plan slice E4) ----
    if (variant === 'kakuro') {
      if (!KAKURO_LADDER.includes(difficulty)) {
        return NextResponse.json({ error: 'Kakuro difficulty must be easy, medium, hard, expert, or extreme' }, { status: 400 });
      }
      if (!KAKURO_SIZES.includes(gridSize)) {
        return NextResponse.json({ error: 'Kakuro grid size must be 6, 7, or 9' }, { status: 400 });
      }
      // Fresh and at exactly the requested tier (E5: the classifier is in the generator's
      // objective); the label is still the classifier's own, so `served` is logged beside the
      // request as a standing check that they agree.
      const puzzle = generateKakuro(difficulty as KakuroLevel, { gridSize: gridSize as KakuroSize });
      logger.info(
        { event: 'puzzle_success', variant: 'kakuro', difficulty, served: puzzle.difficulty, gridSize, durationMs: Math.round(performance.now() - startTime) },
        'Generated interactive Kakuro puzzle',
      );
      return NextResponse.json(puzzle, { status: 200 });
    }

    // ---- Skyscrapers branch (5×5 / 6×6 / 7×7 — plan slice E4) ----
    if (variant === 'skyscrapers') {
      if (!(SKYSCRAPERS_LADDER as readonly string[]).includes(difficulty)) {
        return NextResponse.json({ error: 'Skyscrapers difficulty must be easy, medium, hard, expert, or extreme' }, { status: 400 });
      }
      if (!(SKYSCRAPERS_SIZES as readonly number[]).includes(gridSize)) {
        return NextResponse.json({ error: 'Skyscrapers grid size must be 5, 6, or 7' }, { status: 400 });
      }
      const skySize = gridSize as SkyscrapersSize;
      const skyLevel = difficulty as SkyscrapersLevel;
      // Each size offers the tiers it can produce (D12: the 5×5 mini tops out at hard, the 7×7
      // large starts at medium) — a level outside them is refused here, never served as something
      // else.
      if (!isSkyscrapersLevelOffered(skySize, skyLevel)) {
        return NextResponse.json({ error: `${skySize}×${skySize} Skyscrapers offers ${SKYSCRAPERS_TIERS_BY_SIZE[skySize].join(', ')}` }, { status: 400 });
      }
      // E5: fresh, unique and at exactly the requested tier (the classifier in the generator's
      // objective); the label is still the classifier's own, so `served` is logged beside the
      // request as a standing check that they agree. A throw (out of budget — 0 in the gate run)
      // goes to the generic 500 like the other variants.
      const { puzzle, stats } = generateSkyscrapersDetailed(skyLevel, { gridSize: skySize });
      logger.info(
        { event: 'puzzle_success', variant: 'skyscrapers', difficulty, served: puzzle.difficulty, gridSize, ...stats, durationMs: Math.round(performance.now() - startTime) },
        'Generated interactive Skyscrapers puzzle',
      );
      return NextResponse.json(puzzle, { status: 200 });
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json(
        { error: 'Invalid difficulty: must be easy, medium, hard, expert, or extreme' },
        { status: 400 }
      );
    }

    if (!VALID_GRID_SIZES.includes(gridSize)) {
      return NextResponse.json({ error: 'Invalid gridSize: must be 4, 6, or 9' }, { status: 400 });
    }

    // Expert and Extreme require the elite strategies that only exist on 9x9 grids.
    if (gridSize !== 9 && (difficulty === 'expert' || difficulty === 'extreme')) {
      return NextResponse.json(
        { error: 'Expert and Extreme difficulties are only available for 9x9 grids' },
        { status: 400 }
      );
    }

    // ==========================================
    // GENERATION
    // ==========================================

    const puzzle = generateSinglePuzzle(difficulty, gridSize);

    logger.info(
      {
        event: 'puzzle_success',
        difficulty,
        gridSize,
        durationMs: Math.round(performance.now() - startTime),
      },
      'Generated interactive puzzle'
    );

    return NextResponse.json(puzzle, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(
      {
        event: 'puzzle_failure',
        error: err.message,
        stack: err.stack,
        durationMs: Math.round(performance.now() - startTime),
      },
      'Failed to generate interactive puzzle'
    );

    // Generic 500 only — the message and stack live in the server logs, never on the
    // wire (OWASP Security Misconfiguration; AGENTS.md Section 6).
    return NextResponse.json({ error: 'Internal server error during puzzle generation' }, { status: 500 });
  }
}
