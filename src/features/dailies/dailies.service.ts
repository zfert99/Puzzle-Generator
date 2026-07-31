import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { dailyPuzzles, solveAttempts, type DailyPuzzle } from '@/lib/db/schema';
import {
  rollDailyAssignment,
  toDailyPuzzleRow,
  getProfile,
  difficultyForKey,
  isEligible,
  VARIANTS,
  type PlannedSlot,
  type Variant,
  type DailySize,
  type DailyDifficulty,
} from '@/lib/db/daily-row';
import { generateSudoku, type Difficulty } from '@/features/engine/sudoku';
import { generateKillerSudoku, type KillerDifficulty } from '@/features/engine/killer/killer-sudoku';
import { generateCalcSudoku } from '@/features/engine/calc/calc-sudoku';
import type { CalcDifficulty } from '@/features/engine/calc/calc-types';
import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import { BOT_USER_ID, ensureBotUser } from '@/features/leaderboards/bot';
import { logger } from '@/lib/logger';

/**
 * Daily-puzzle data access. Every function takes the Drizzle `db` as its first
 * argument rather than importing the `server-only` client at module scope — that keeps
 * this module importable from BOTH the API routes (which pass the guarded app client)
 * and the standalone seed script (which runs under `tsx`, where the guard would throw).
 * The `Database` import is type-only, so nothing here pulls the Neon driver at import.
 *
 * All access is parameterized through Drizzle (AGENTS.md §6). Ownership/authorization is
 * not a concern here — daily puzzles are shared, public, and read-only to clients; the
 * BOLA-sensitive writes live in the leaderboard/solve service (4.3.1 / 4.4).
 */

export interface GenerateDailiesResult {
  isoDate: string;
  requested: number;
  inserted: number;
}

type EnginePuzzle = SudokuPuzzle | KillerPuzzle | CalcPuzzle;

/** Generate the puzzle for one slot, dispatching by the slot's rolled variant. */
function generatePuzzleFor(slot: PlannedSlot): EnginePuzzle {
  switch (slot.variant) {
    case 'killer':
      return generateKillerSudoku(slot.difficulty as KillerDifficulty, { gridSize: slot.gridSize });
    case 'calc':
      return generateCalcSudoku(slot.difficulty as CalcDifficulty, { gridSize: slot.gridSize });
    default:
      return generateSudoku(slot.difficulty as Difficulty, slot.gridSize);
  }
}

/**
 * Other boards eligible for this slot — the fallback pool. The slot KEY and difficulty stay fixed
 * (so leaderboard identity and the day's distinct key set are preserved); only the variant (and, for
 * minis, the size) changes. Standard slots are 9×9-only; mini slots may swap between 4×4 and 6×6.
 */
function eligibleAlternatives(slot: PlannedSlot): PlannedSlot[] {
  const sizes: DailySize[] = slot.section === 'standard' ? [9] : [4, 6];
  const alts: PlannedSlot[] = [];
  for (const variant of VARIANTS) {
    for (const gridSize of sizes) {
      if (variant === slot.variant && gridSize === slot.gridSize) continue;
      if (isEligible(variant, gridSize, slot.difficulty)) alts.push({ ...slot, variant, gridSize });
    }
  }
  return alts;
}

/** Attempts per slot before falling back to an alternative eligible board. */
const SLOT_RETRIES = 3;

/**
 * Generate a slot's puzzle, never leaving it empty (Risk #2). The tuned generators effectively
 * never throw at these settings, so this is belt-and-braces: retry the rolled board, then fall back
 * to another eligible board for the same slot, alerting via `logger.warn` so a fallback is visible.
 * Returns the FINAL slot (its variant/size may differ from the rolled one) alongside the puzzle.
 */
function generateSlotWithFallback(
  slot: PlannedSlot,
  generate: (slot: PlannedSlot) => EnginePuzzle,
): { slot: PlannedSlot; puzzle: EnginePuzzle } {
  for (let attempt = 1; attempt <= SLOT_RETRIES; attempt++) {
    try {
      return { slot, puzzle: generate(slot) };
    } catch (error) {
      logger.warn(
        { event: 'daily_slot_retry', key: slot.key, variant: slot.variant, size: slot.gridSize, attempt, error: (error as Error).message },
        'Retrying daily slot generation',
      );
    }
  }
  for (const alt of eligibleAlternatives(slot)) {
    try {
      const puzzle = generate(alt);
      logger.warn(
        { event: 'daily_slot_fallback', key: slot.key, from: slot.variant, to: alt.variant, size: alt.gridSize },
        'Daily slot fell back to an alternative board',
      );
      return { slot: alt, puzzle };
    } catch {
      // try the next alternative
    }
  }
  throw new Error(`Could not generate daily slot ${slot.key} (${slot.variant} ${slot.gridSize} ${slot.difficulty})`);
}

/**
 * Generate and persist one day's dailies for `isoDate` (UTC): a per-day roll over the type-as-slot
 * model (3 standard + 3 mini today; see `daily-row.ts`). Idempotent — the `UNIQUE(date, difficulty)`
 * constraint plus `onConflictDoNothing` make a re-run a no-op, so the cron is safe to retry and a
 * same-day second call inserts 0. `rng` is injectable for deterministic tests.
 */
export async function generateDailyPuzzles(
  db: Database,
  isoDate: string,
  options: {
    /** RNG for the daily roll (default `Math.random`). Inject a seeded PRNG for determinism. */
    rng?: () => number;
    /** Puzzle generator seam (default dispatches to the real engines). Injected only in tests. */
    generate?: (slot: PlannedSlot) => EnginePuzzle;
  } = {},
): Promise<GenerateDailiesResult> {
  await ensureBotUser(db);

  // Roll the day's assignment, then generate each slot with a never-empty fallback. Heavy hitters
  // are the 9×9 extreme tiers (Killer-extreme ~5.5 s), but only one standard slot can be Killer and
  // only if extreme rolls onto it — the cron route's maxDuration carries headroom for the sum.
  const generate = options.generate ?? generatePuzzleFor;
  const slots = rollDailyAssignment(options.rng ?? Math.random);
  const rows = slots.map((slot) => {
    const { slot: finalSlot, puzzle } = generateSlotWithFallback(slot, generate);
    return toDailyPuzzleRow(puzzle, isoDate, finalSlot.key);
  });

  const inserted = await db
    .insert(dailyPuzzles)
    .values(rows)
    .onConflictDoNothing({ target: [dailyPuzzles.date, dailyPuzzles.difficulty] })
    .returning({ id: dailyPuzzles.id });

  await seedBotSolves(db, isoDate);

  return { isoDate, requested: rows.length, inserted: inserted.length };
}

/**
 * Give "Sudoku Bot" (`features/leaderboards/bot.ts`) a clean, good-but-beatable solve on
 * every one of today's boards — a visible "time to beat" while the real player base is
 * small. Runs a fresh SELECT of today's rows (not the insert's `.returning()`, which only
 * covers rows inserted THIS call) so it also backfills boards generated by an earlier run.
 * The bot's time comes from the profile table keyed on the row's actual `(variant, size,
 * difficulty)` — not the slot key, whose type now varies per day. Idempotent via the same
 * `(user, puzzle)` unique index real players' attempts already enforce.
 */
async function seedBotSolves(db: Database, isoDate: string): Promise<void> {
  const todaysPuzzles = await db
    .select({
      id: dailyPuzzles.id,
      key: dailyPuzzles.difficulty,
      variant: dailyPuzzles.variant,
      grid: dailyPuzzles.grid,
    })
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.date, isoDate));

  const attempts = todaysPuzzles
    .map((p) => {
      const profile = getProfile(p.variant as Variant, p.grid.length as DailySize, difficultyForKey(p.key));
      if (!profile) return null;
      return {
        userId: BOT_USER_ID,
        puzzleId: p.id,
        timeMs: profile.botTimeMs,
        completed: true,
        mistakes: 0,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  if (attempts.length === 0) return;

  await db
    .insert(solveAttempts)
    .values(attempts)
    .onConflictDoNothing({ target: [solveAttempts.userId, solveAttempts.puzzleId] });
}

/**
 * Fetch the single daily puzzle for a given UTC date + difficulty, or `null` if the
 * cron has not generated it yet. Returns the full row including `solution`; the CALLER
 * (the route) decides what to expose to the client.
 */
export async function getDailyPuzzle(
  db: Database,
  isoDate: string,
  difficulty: DailyDifficulty,
): Promise<DailyPuzzle | null> {
  const [row] = await db
    .select()
    .from(dailyPuzzles)
    .where(and(eq(dailyPuzzles.date, isoDate), eq(dailyPuzzles.difficulty, difficulty)))
    .limit(1);

  return row ?? null;
}
