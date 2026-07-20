import { NextRequest, NextResponse } from 'next/server';
import { generateSinglePuzzle } from '@/features/engine/services/generation.service';
import { generateKillerSudoku, type KillerDifficulty } from '@/features/engine/killer/killer-sudoku';
import { Difficulty, GridSize } from '@/features/engine/sudoku';
import { logger } from '@/lib/logger';

const KILLER_DIFFICULTIES: KillerDifficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];

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
