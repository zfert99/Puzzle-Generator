import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';
import type { CalcOperator } from '@/features/engine/calc/calc-types';

/**
 * Phase 4 — app persistence schema (Drizzle / Postgres).
 *
 * This is the stateful pivot for the app: one shared daily puzzle per difficulty
 * per day, and each user's ranked solve attempt. Auth-identity tables (the canonical
 * `user`, OAuth accounts, passkeys, sessions) live in [auth-schema.ts](./auth-schema.ts),
 * owned by better-auth's Drizzle adapter (4.3). `solve_attempts` references that `user`.
 *
 * Historical note: 4.1 shipped a minimal custom `users` (uuid) table; 4.3 replaced it
 * with better-auth's string-id `user`, so `solve_attempts.user_id` is now `text`.
 *
 * Security posture (AGENTS.md §6): every column is reached only through Drizzle's
 * parameterized query builder — never string-built SQL. `solution` is server-only and
 * must never be serialized to the client for an unsolved daily.
 */

/** A 9x9 grid stored as JSON — rows of numbers, 0 for an empty cell. */
export type Grid = number[][];

/** A Killer cage as stored in `daily_puzzles.cages` — mirrors the engine's `Cage` shape. */
export interface StoredKillerCage {
  id: number;
  sum: number;
  /** Flat cell indices (row * size + col) covered by this cage. */
  cells: number[];
}

/** A Keisan (Calcudoku) cage — mirrors the engine's `CalcCage` (operator + target instead of sum). */
export interface StoredCalcCage {
  id: number;
  op: CalcOperator;
  target: number;
  cells: number[];
  /** Mystery / No-Op (K6): operator hidden from the player. Omitted for normal cages. jsonb, no migration. */
  noOp?: boolean;
}

/**
 * A cage as stored in `daily_puzzles.cages` (jsonb). Killer rows carry `sum`, Keisan rows carry
 * `op` + `target` — the row's registry KEY (`daily-row.ts`) says which variant, so the serving
 * route picks the right interpretation. The column shape is untyped jsonb, so no migration was
 * needed to add the Keisan variant.
 */
export type StoredCage = StoredKillerCage | StoredCalcCage;

/**
 * One shared puzzle per difficulty per calendar day (UTC). The `UNIQUE(date,
 * difficulty)` constraint makes the daily-generation cron idempotent: re-running it
 * upserts rather than duplicating.
 */
export const dailyPuzzles = pgTable(
  'daily_puzzles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Calendar day this puzzle belongs to, at 00:00 UTC rollover. */
    date: date('date').notNull(),
    /**
     * The daily-board KEY (`daily-row.ts`) — the `UNIQUE(date, difficulty)` idempotency handle,
     * API param, and leaderboard identity. Historically it encoded the puzzle TYPE too
     * (`killer-easy`, `calc9-hard`); the type-as-slot restructure moves type into `variant` and
     * keys standard slots by rung (`easy…extreme`), minis by `mini-<tier>`.
     */
    difficulty: text('difficulty').notNull(),
    /**
     * Puzzle TYPE, stored so readers no longer infer it from the `difficulty` key (the key's type
     * encoding is being retired). Backfilled from historical keys by migration `0004`.
     */
    variant: text('variant').$type<'classic' | 'killer' | 'calc'>().notNull(),
    /** Unsolved puzzle sent to the client. */
    grid: jsonb('grid').$type<Grid>().notNull(),
    /** Solved grid — SERVER-ONLY. Never returned for an unsolved daily (anti-cheat). */
    solution: jsonb('solution').$type<Grid>().notNull(),
    /** Number of given clues — denormalized for cheap display/sorting. Cage count for Killer/Keisan. */
    clueCount: integer('clue_count').notNull(),
    /**
     * Cages for a caged daily (Killer sum, or Keisan operator+target), or NULL for classic. Which
     * interpretation applies is told by the row's `variant` column (Killer and Keisan both carry
     * cages, so cage presence alone can't distinguish them). The column is untyped jsonb, so adding
     * the Keisan variant needed no migration.
     */
    cages: jsonb('cages').$type<StoredCage[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('daily_puzzles_date_difficulty_key').on(table.date, table.difficulty)],
);

/**
 * A user's ranked attempt at a daily puzzle. `time_ms` is the CLIENT's in-game timer — a
 * deliberate tradeoff that makes save-and-continue fair, with a server-side plausibility
 * floor as the guard (see `solve-rules.ts`). It is `integer` (int4), so every write clamps
 * to that range rather than trusting the submitted number.
 *
 * `UNIQUE(user_id, puzzle_id)` caps one attempt ROW per user per puzzle, but it cannot police
 * the completion transition — that is enforced by `recordSolve`'s conditional
 * `WHERE … AND completed = false`. Rows cascade-delete with their user or puzzle.
 *
 * `user_id` is `text` and references better-auth's `user.id` (a string id), not a uuid.
 */
export const solveAttempts = pgTable(
  'solve_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    puzzleId: uuid('puzzle_id')
      .notNull()
      .references(() => dailyPuzzles.id, { onDelete: 'cascade' }),
    /** Solve duration in milliseconds, from the client's in-game timer. int4 — writes clamp. */
    timeMs: integer('time_ms').notNull(),
    completed: boolean('completed').default(false).notNull(),
    mistakes: integer('mistakes').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('solve_attempts_user_puzzle_key').on(table.userId, table.puzzleId),
    // Leaderboard ordering: fastest completed times for a given puzzle.
    index('solve_attempts_puzzle_time_idx').on(table.puzzleId, table.timeMs),
  ],
);

export type DailyPuzzle = typeof dailyPuzzles.$inferSelect;
export type NewDailyPuzzle = typeof dailyPuzzles.$inferInsert;
export type SolveAttempt = typeof solveAttempts.$inferSelect;
export type NewSolveAttempt = typeof solveAttempts.$inferInsert;
