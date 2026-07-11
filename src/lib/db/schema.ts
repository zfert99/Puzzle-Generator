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
    /** easy | medium | hard | expert — 'extreme' is excluded from dailies for now. */
    difficulty: text('difficulty').notNull(),
    /** Unsolved puzzle sent to the client. */
    grid: jsonb('grid').$type<Grid>().notNull(),
    /** Solved grid — SERVER-ONLY. Never returned for an unsolved daily (anti-cheat). */
    solution: jsonb('solution').$type<Grid>().notNull(),
    /** Number of given clues — denormalized for cheap display/sorting. */
    clueCount: integer('clue_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('daily_puzzles_date_difficulty_key').on(table.date, table.difficulty)],
);

/**
 * A user's ranked attempt at a daily puzzle. `time_ms` is SERVER-COMPUTED (4.4) — a
 * client-reported solve time is never trusted. `UNIQUE(user_id, puzzle_id)` enforces
 * one ranked attempt per user per puzzle; the `(puzzle_id, time_ms)` index backs
 * leaderboard ordering. Rows cascade-delete with their user or puzzle.
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
    /** Server-computed solve duration in milliseconds. */
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
