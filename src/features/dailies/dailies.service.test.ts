import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/db/connection';
import { generateDailyPuzzles, getDailyPuzzle } from './dailies.service';
import {
  rollDailyAssignment,
  getProfile,
  difficultyForKey,
  type PlannedSlot,
  type Variant,
  type DailySize,
} from '@/lib/db/daily-row';
import { dailyPuzzles, solveAttempts, type NewDailyPuzzle } from '@/lib/db/schema';
import { user } from '@/lib/db/auth-schema';
import { BOT_USER_ID } from '@/features/leaderboards/bot-identity';

/**
 * The DB is mocked at the boundary (a stand-in Drizzle client), and the PUZZLE GENERATOR is
 * injected via the service's `generate` seam so these tests are fast and deterministic — the roll
 * (pure) and the row-mapping/orchestration all run for real; only the engine call is stubbed.
 * (The roll's own invariants are covered in `daily-row.test.ts`.)
 */

const SEED = 7;

/** Deterministic PRNG matching daily-row's tests. */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grid(size: number): number[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}
function solution(size: number): number[][] {
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ((r + c) % size) + 1));
}

/** A minimal engine-shaped puzzle for a slot (classic has no `variant`; killer/calc carry cages). */
function fakePuzzle(slot: PlannedSlot) {
  const base = { grid: grid(slot.gridSize), solution: solution(slot.gridSize) };
  if (slot.variant === 'classic') return base as never;
  return {
    ...base,
    variant: slot.variant,
    cages: [{ id: 0, sum: 3, op: '+', target: 3, cells: [0, 1] }],
    difficulty: slot.difficulty,
    gridSize: slot.gridSize,
  } as never;
}

interface BotAttemptRow {
  userId: string;
  puzzleId: string;
  timeMs: number;
  completed: boolean;
  mistakes: number;
}

/** A `db` stand-in covering every table `generateDailyPuzzles` touches this call. */
function makeDb(options: {
  puzzleReturning: (rows: NewDailyPuzzle[]) => Promise<{ id: string }[]>;
  selectRows: { id: string; key: string; variant: string; grid: number[][] }[];
  /** Rows the idempotency guard's existence probe sees. Empty (default) = a fresh, unrolled day. */
  existingRows?: { id: string }[];
  onPuzzleValues?: (rows: NewDailyPuzzle[]) => void;
  onAttemptsValues?: (rows: BotAttemptRow[]) => void;
}) {
  const insert = vi.fn((table: unknown) => {
    if (table === user) {
      // The bot row is upserted (a rename must reach an existing row), not do-nothing.
      return { values: () => ({ onConflictDoUpdate: async () => undefined }) };
    }
    if (table === dailyPuzzles) {
      return {
        values: (rows: NewDailyPuzzle[]) => {
          options.onPuzzleValues?.(rows);
          return { onConflictDoNothing: () => ({ returning: async () => options.puzzleReturning(rows) }) };
        },
      };
    }
    if (table === solveAttempts) {
      return {
        values: (rows: BotAttemptRow[]) => {
          options.onAttemptsValues?.(rows);
          return { onConflictDoNothing: async () => undefined };
        },
      };
    }
    throw new Error('unexpected table in insert()');
  });
  // Two different selects run here: the idempotency guard's existence probe (`.where().limit(1)`)
  // and the bot-seeding fetch (`.where()` awaited directly). The `where` result serves both — it is
  // awaitable AND carries `.limit`.
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        limit: async () => options.existingRows ?? [],
        then: (resolve: (rows: typeof options.selectRows) => unknown) => Promise.resolve(options.selectRows).then(resolve),
      }),
    }),
  }));
  return { insert, select } as unknown as Database;
}

/** The rows the seed-select would see, derived from the same seeded roll (no fallback in happy path). */
function selectRowsForRoll(slots: PlannedSlot[]) {
  return slots.map((s, i) => ({ id: `id-${i}`, key: s.key, variant: s.variant, grid: grid(s.gridSize) }));
}

describe('generateDailyPuzzles (type-as-slot roller)', () => {
  /**
   * Regression: the roll is RANDOM, so `UNIQUE(date, difficulty)` + `onConflictDoNothing` no longer
   * makes a re-run a no-op the way the old fixed registry did — a second run draws different rungs,
   * which don't collide and get inserted ALONGSIDE the existing ones, turning a 6-board day into 8+.
   * This already happened once in production (2026-07-31 ended up with 33 rows). A cron retry or a
   * manual seed must therefore leave a populated day completely untouched.
   */
  it('never re-rolls a day that already has boards (idempotency guard)', async () => {
    const rolled = rollDailyAssignment(mulberry32(SEED));
    let puzzleInsertHappened = false;
    let attemptRows: BotAttemptRow[] = [];
    const db = makeDb({
      puzzleReturning: async (rows) => rows.map((_, i) => ({ id: `id-${i}` })),
      selectRows: selectRowsForRoll(rolled),
      existingRows: [{ id: 'already-here' }], // the day is already populated
      onPuzzleValues: () => {
        puzzleInsertHappened = true;
      },
      onAttemptsValues: (rows) => {
        attemptRows = rows;
      },
    });

    const result = await generateDailyPuzzles(db, '2026-08-01', { rng: mulberry32(SEED), generate: fakePuzzle });

    expect(result).toEqual({ isoDate: '2026-08-01', requested: 0, inserted: 0, skipped: true });
    expect(puzzleInsertHappened).toBe(false); // no extra boards written
    // Bot seeding still runs — it IS idempotent, and backfilling a missing bot row is the useful
    // half of a re-run.
    expect(attemptRows.length).toBeGreaterThan(0);
  });

  it('generates one row per slot (6 today), each carrying its rolled variant', async () => {
    const rolled = rollDailyAssignment(mulberry32(SEED));
    let puzzleRows: NewDailyPuzzle[] = [];
    const db = makeDb({
      puzzleReturning: async (rows) => rows.map((_, i) => ({ id: `id-${i}` })),
      selectRows: selectRowsForRoll(rolled),
      onPuzzleValues: (rows) => {
        puzzleRows = rows;
      },
    });

    const result = await generateDailyPuzzles(db, '2026-08-01', { rng: mulberry32(SEED), generate: fakePuzzle });

    expect(result).toEqual({ isoDate: '2026-08-01', requested: 6, inserted: 6, skipped: false });
    expect(puzzleRows).toHaveLength(6);
    // Keys match the roll; every row stores a real variant; classic rows carry no cages.
    expect(puzzleRows.map((r) => r.difficulty).sort()).toEqual(rolled.map((s) => s.key).sort());
    expect(puzzleRows.every((r) => ['classic', 'killer', 'calc'].includes(r.variant))).toBe(true);
    for (const r of puzzleRows) {
      if (r.variant === 'classic') expect(r.cages).toBeNull();
      else expect(r.cages).not.toBeNull();
    }
  });

  it("seeds Puzzle Bot on every board at that board's profile time (via variant/size, not key)", async () => {
    const rolled = rollDailyAssignment(mulberry32(SEED));
    let attemptRows: BotAttemptRow[] = [];
    const selectRows = selectRowsForRoll(rolled);
    const db = makeDb({
      puzzleReturning: async (rows) => rows.map((_, i) => ({ id: `id-${i}` })),
      selectRows,
      onAttemptsValues: (rows) => {
        attemptRows = rows;
      },
    });

    await generateDailyPuzzles(db, '2026-08-01', { rng: mulberry32(SEED), generate: fakePuzzle });

    expect(attemptRows).toHaveLength(6);
    expect(attemptRows.every((r) => r.userId === BOT_USER_ID && r.completed && r.mistakes === 0)).toBe(true);
    const timeById = new Map(attemptRows.map((r) => [r.puzzleId, r.timeMs]));
    for (const row of selectRows) {
      const profile = getProfile(row.variant as Variant, row.grid.length as DailySize, difficultyForKey(row.key));
      expect(timeById.get(row.id)).toBe(profile!.botTimeMs);
    }
  });

  it('reports 0 inserted when today already exists (conflict)', async () => {
    const rolled = rollDailyAssignment(mulberry32(SEED));
    const db = makeDb({
      puzzleReturning: async () => [], // conflict: nothing inserted
      selectRows: selectRowsForRoll(rolled),
    });

    const result = await generateDailyPuzzles(db, '2026-08-01', { rng: mulberry32(SEED), generate: fakePuzzle });
    expect(result).toEqual({ isoDate: '2026-08-01', requested: 6, inserted: 0, skipped: false });
  });

  it('never leaves a slot empty: falls back to an eligible board when a generator throws', async () => {
    // A generator that always fails for Killer — every Killer slot (standard always has one) must
    // fall back to an eligible non-Killer board, still yielding 6 rows and zero Killer rows.
    const failKiller = (slot: PlannedSlot) => {
      if (slot.variant === 'killer') throw new Error('boom');
      return fakePuzzle(slot);
    };
    let puzzleRows: NewDailyPuzzle[] = [];
    const db = makeDb({
      puzzleReturning: async (rows) => rows.map((_, i) => ({ id: `id-${i}` })),
      selectRows: [],
      onPuzzleValues: (rows) => {
        puzzleRows = rows;
      },
    });

    const result = await generateDailyPuzzles(db, '2026-08-01', { rng: mulberry32(SEED), generate: failKiller });

    expect(result.requested).toBe(6);
    expect(puzzleRows).toHaveLength(6);
    expect(puzzleRows.some((r) => r.variant === 'killer')).toBe(false); // all Killer slots fell back
  });
});

describe('getDailyPuzzle', () => {
  it('returns the row for a matching date + difficulty', async () => {
    const row = { id: 'p1', date: '2026-07-11', difficulty: 'medium' };
    const limit = vi.fn(async () => [row]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const db = { select: () => ({ from }) } as unknown as Database;

    const result = await getDailyPuzzle(db, '2026-07-11', 'medium');
    expect(result).toBe(row);
  });

  it('returns null when no puzzle exists for that day', async () => {
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    } as unknown as Database;

    const result = await getDailyPuzzle(db, '2026-07-11', 'expert');
    expect(result).toBeNull();
  });
});
