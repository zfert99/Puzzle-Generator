import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import type { Grid, NewDailyPuzzle } from './schema';

/**
 * The daily registry — **type-as-slot** model. One daily slot per puzzle TYPE with the
 * DIFFICULTY randomized, replacing the old flat 30-board `DAILY_BOARDS` wall. See
 * `Docs/daily-redesign-plan.md`. Two data structures:
 *
 * - **Slots** — what the cron generates each day: standard slots keyed by difficulty RUNG
 *   (`easy…extreme`, 3 of 5 drawn/day) + mini slots keyed `mini-<tier>` (always 3). The TYPE is
 *   rolled per day and stored in `daily_puzzles.variant` — the key no longer encodes it.
 * - **Profile table** (`PROFILE`) — per `(variant, size, difficulty)`: `minSolveMs` (anti-cheat
 *   plausibility floor, see `solve-rules.md`) and `botTimeMs` (Puzzle Bot's beatable time). Values
 *   moved verbatim from the old registry + the new `(killer,4,easy)` row.
 *
 * The old per-string keys (`killer-*`, `calc*`, `mini4-*`, `mini6-*`, `killer6-*`, legacy `killer`)
 * are **retired from generation** but stay valid for archive replay (see `LEGACY_KEYS` /
 * `isDailyDifficulty`); historical rows carry their backfilled `variant` (migration `0004`).
 */

/** Puzzle type. Mirrors the engine variants and the stored `daily_puzzles.variant`. */
export type Variant = 'classic' | 'killer' | 'calc';
/** The five 9×9 difficulty rungs. Standard slots are keyed by these. */
export type StandardRung = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';
/** Mini difficulties — the 3-tier ladder (no expert/extreme minis). */
export type MiniTier = 'easy' | 'medium' | 'hard';
/** A supported daily grid size. */
export type DailySize = 4 | 6 | 9;

/**
 * Any daily key routes accept. Kept as `string` because keys are now data-driven (slot keys +
 * retired legacy keys for archive); `isDailyDifficulty` is the runtime validator.
 */
export type DailyDifficulty = string;

export const VARIANTS: readonly Variant[] = ['classic', 'killer', 'calc'];
export const STANDARD_RUNGS: readonly StandardRung[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];
const MINI_TIERS: readonly MiniTier[] = ['easy', 'medium', 'hard'];
/** Mini slot keys, one per tier. The type they hold is rolled per day. */
export const MINI_KEYS: Record<MiniTier, string> = {
  easy: 'mini-easy',
  medium: 'mini-medium',
  hard: 'mini-hard',
};

/** One resolved daily slot for a given day — what the cron generates and stores. */
export interface PlannedSlot {
  /** The `daily_puzzles.difficulty` value: a rung (standard) or `mini-<tier>` (mini). */
  key: string;
  section: 'standard' | 'mini';
  variant: Variant;
  gridSize: DailySize;
  /** The engine difficulty to generate at (a rung; minis only use easy/medium/hard). */
  difficulty: StandardRung;
}

interface ProfileEntry {
  /** Anti-cheat plausibility floor (ms) — conservative lower bound, not a record. */
  minSolveMs: number;
  /** Puzzle Bot's hand-tuned "good, beatable" time (ms) on this board — flavor, not derived. */
  botTimeMs: number;
}

/**
 * Per-`(variant, size, difficulty)` tuning. Values moved verbatim from the pre-restructure
 * registry; `killer-4-easy` is new (Step 2 de-risk — a beginner tier a notch above Keisan 4×4
 * since Killer starts with no givens). Every ELIGIBLE combo has an entry — the coverage test
 * asserts `isEligible ⟺ getProfile` so a rolled slot can never miss its floor/bot time.
 */
const PROFILE: Record<string, ProfileEntry> = {
  // ---- Standard 9×9 ----
  'classic-9-easy': { minSolveMs: 15_000, botTimeMs: 210_000 },
  'classic-9-medium': { minSolveMs: 20_000, botTimeMs: 360_000 },
  'classic-9-hard': { minSolveMs: 25_000, botTimeMs: 600_000 },
  'classic-9-expert': { minSolveMs: 30_000, botTimeMs: 960_000 },
  'classic-9-extreme': { minSolveMs: 45_000, botTimeMs: 1_500_000 },
  'killer-9-easy': { minSolveMs: 20_000, botTimeMs: 330_000 },
  'killer-9-medium': { minSolveMs: 30_000, botTimeMs: 540_000 },
  'killer-9-hard': { minSolveMs: 40_000, botTimeMs: 840_000 },
  'killer-9-expert': { minSolveMs: 50_000, botTimeMs: 1_200_000 },
  'killer-9-extreme': { minSolveMs: 60_000, botTimeMs: 1_800_000 },
  'calc-9-easy': { minSolveMs: 25_000, botTimeMs: 420_000 },
  'calc-9-medium': { minSolveMs: 35_000, botTimeMs: 660_000 },
  'calc-9-hard': { minSolveMs: 50_000, botTimeMs: 1_080_000 },
  'calc-9-expert': { minSolveMs: 70_000, botTimeMs: 1_500_000 },
  'calc-9-extreme': { minSolveMs: 90_000, botTimeMs: 1_920_000 },
  // ---- Minis (4×4 / 6×6) ----
  'classic-4-easy': { minSolveMs: 3_000, botTimeMs: 40_000 },
  'classic-4-medium': { minSolveMs: 4_000, botTimeMs: 60_000 },
  'classic-4-hard': { minSolveMs: 5_000, botTimeMs: 90_000 },
  'classic-6-easy': { minSolveMs: 8_000, botTimeMs: 75_000 },
  'classic-6-medium': { minSolveMs: 10_000, botTimeMs: 120_000 },
  'classic-6-hard': { minSolveMs: 12_000, botTimeMs: 180_000 },
  'killer-4-easy': { minSolveMs: 4_000, botTimeMs: 60_000 },
  'killer-6-easy': { minSolveMs: 10_000, botTimeMs: 120_000 },
  'killer-6-medium': { minSolveMs: 12_000, botTimeMs: 195_000 },
  'killer-6-hard': { minSolveMs: 15_000, botTimeMs: 270_000 },
  'calc-4-easy': { minSolveMs: 4_000, botTimeMs: 55_000 },
  'calc-4-medium': { minSolveMs: 5_000, botTimeMs: 85_000 },
  'calc-4-hard': { minSolveMs: 6_000, botTimeMs: 130_000 },
  'calc-6-easy': { minSolveMs: 10_000, botTimeMs: 150_000 },
  'calc-6-medium': { minSolveMs: 14_000, botTimeMs: 240_000 },
  'calc-6-hard': { minSolveMs: 20_000, botTimeMs: 390_000 },
};

/** The tuning for a `(variant, size, difficulty)`, or `undefined` if not an eligible combo. */
export function getProfile(
  variant: Variant,
  gridSize: DailySize,
  difficulty: StandardRung,
): ProfileEntry | undefined {
  return PROFILE[`${variant}-${gridSize}-${difficulty}`];
}

/**
 * Whether a `(variant, size, difficulty)` is a real daily board. Standard = every type at 9×9 on
 * all five rungs. Minis = 3-tier only; classic/calc at 4×4 and 6×6; **Killer is easy-only at 4×4**
 * (de-risked — tiers collapse to tier-1 on a 16-cell no-givens grid) but full e/m/h at 6×6.
 */
export function isEligible(variant: Variant, gridSize: DailySize, difficulty: StandardRung): boolean {
  if (gridSize === 9) return true;
  if (difficulty === 'expert' || difficulty === 'extreme') return false; // no expert/extreme minis
  if (variant === 'killer') return gridSize === 4 ? difficulty === 'easy' : true;
  return true; // classic / calc: any 4×4 or 6×6 e/m/h
}

/**
 * The difficulty RUNG a key refers to. Handles every key shape, active and retired, because the
 * anti-cheat floor and the bot time are looked up by rung — a retired key that resolved to no rung
 * would silently fall back to the permissive default floor, and archived keys are still solvable on
 * the cutover date (that day holds both old and new rows).
 *
 * ```text
 * hard            -> hard      (active standard: the key IS the rung)
 * mini-hard       -> hard      (active mini)
 * killer-extreme  -> extreme   (retired: rung is the trailing segment)
 * calc9-expert    -> expert
 * mini4-easy      -> easy
 * killer          -> medium    (the pre-ladder single Killer daily was engine-medium — this
 *                               reproduces its historical 30 s floor exactly)
 * ```
 */
export function difficultyForKey(key: string): StandardRung {
  if ((STANDARD_RUNGS as readonly string[]).includes(key)) return key as StandardRung;
  const tail = key.slice(key.lastIndexOf('-') + 1);
  if ((STANDARD_RUNGS as readonly string[]).includes(tail)) return tail as StandardRung;
  return 'medium'; // legacy 'killer' (and any unknown key): the historical engine difficulty
}

/** Fisher–Yates copy shuffle driven by an injectable RNG (deterministic in tests). */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The 6 permutations of three indices — used to assign the 3 types to the 3 mini slots. */
const PERMS_3: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

/**
 * Roll one day's assignment: a valid, distinct set of daily slots. Pure (RNG injected) so the
 * cron and tests share it. Returns 3 standard + 3 mini slots (6 total, scaling to 5+5 at 5 types).
 *
 * - **Standard:** draw 3 distinct rungs of the 5, assign one to each type (a random injection). All
 *   types cover the full 9×9 ladder, so any pairing is valid; keys are the rungs → distinct.
 * - **Minis:** enumerate every valid `(type→slot permutation × hard-slot size ∈ {4,6})` under
 *   `isEligible`, then pick one uniformly. This guarantees Killer only ever lands on easy-4×4 or a
 *   6×6 hard slot; a valid config always exists (classic/Keisan cover medium/hard-4×4).
 */
export function rollDailyAssignment(rng: () => number = Math.random): PlannedSlot[] {
  const rungs = shuffle(STANDARD_RUNGS, rng).slice(0, VARIANTS.length);
  const types = shuffle(VARIANTS, rng);
  const standard: PlannedSlot[] = rungs.map((difficulty, i) => ({
    key: difficulty,
    section: 'standard',
    variant: types[i],
    gridSize: 9,
    difficulty,
  }));

  // Easy and medium minis are always 4×4; only the hard slot's size is rolled (below).
  const configs: { variant: Variant; gridSize: DailySize; difficulty: MiniTier }[][] = [];
  for (const hardSize of [4, 6] as const) {
    for (const perm of PERMS_3) {
      const assignment = perm.map((typeIdx, slotIdx) => ({
        variant: VARIANTS[typeIdx],
        gridSize: (slotIdx === 2 ? hardSize : 4) as DailySize,
        difficulty: MINI_TIERS[slotIdx],
      }));
      if (assignment.every((a) => isEligible(a.variant, a.gridSize, a.difficulty))) {
        configs.push(assignment);
      }
    }
  }
  const chosen = configs[Math.floor(rng() * configs.length)];
  const minis: PlannedSlot[] = chosen.map((a) => ({
    key: MINI_KEYS[a.difficulty],
    section: 'mini',
    variant: a.variant,
    gridSize: a.gridSize,
    difficulty: a.difficulty,
  }));

  return [...standard, ...minis];
}

/** Active slot keys (generated today). */
const ACTIVE_KEYS: readonly string[] = [...STANDARD_RUNGS, ...Object.values(MINI_KEYS)];

/**
 * Retired keys — no longer generated, but still accepted so archived rows replay. The bare rungs
 * (`easy…extreme`) are active AND historically classic, so they live in `ACTIVE_KEYS` above.
 */
const LEGACY_KEYS: readonly string[] = [
  'killer', // pre-ladder single Killer daily
  'killer-easy', 'killer-medium', 'killer-hard', 'killer-expert', 'killer-extreme',
  'killer6-easy', 'killer6-medium', 'killer6-hard',
  'mini4-easy', 'mini4-medium', 'mini4-hard',
  'mini6-easy', 'mini6-medium', 'mini6-hard',
  'calc4-easy', 'calc4-medium', 'calc4-hard',
  'calc6-easy', 'calc6-medium', 'calc6-hard',
  'calc9-easy', 'calc9-medium', 'calc9-hard', 'calc9-expert', 'calc9-extreme',
];

const ALL_KEYS = new Set<string>([...ACTIVE_KEYS, ...LEGACY_KEYS]);

/** Narrowing guard for route input — an active slot key or a retired key (archive replay). */
export function isDailyDifficulty(value: unknown): value is DailyDifficulty {
  return typeof value === 'string' && ALL_KEYS.has(value);
}

const LEGACY_LABELS: readonly [RegExp, (tier: string) => string][] = [
  [/^killer6-(.+)$/, (t) => `killer 6×6 ${t}`],
  [/^killer-(.+)$/, (t) => `killer ${t}`],
  [/^mini4-(.+)$/, (t) => `4×4 ${t}`],
  [/^mini6-(.+)$/, (t) => `6×6 ${t}`],
  [/^calc4-(.+)$/, (t) => `keisan 4×4 ${t}`],
  [/^calc6-(.+)$/, (t) => `keisan 6×6 ${t}`],
  [/^calc9-(.+)$/, (t) => `keisan ${t}`],
];

/**
 * Human label for a daily KEY alone (no variant context) — used for saved-game banners, archived
 * rows, and bests. Active standard keys are the bare rung; minis read `mini <tier>`; retired keys
 * keep their old prettified form. The "Difficulty · Type" composition (which needs the row's stored
 * `variant`) is Step 4 UI work, not this function.
 */
export function formatDailyKey(key: string): string {
  if ((STANDARD_RUNGS as readonly string[]).includes(key)) return key;
  if (key.startsWith('mini-')) return `mini ${key.slice(5)}`;
  if (key === 'killer') return 'killer';
  for (const [re, fmt] of LEGACY_LABELS) {
    const m = re.exec(key);
    if (m) return fmt(m[1]);
  }
  return key;
}

/** Count the given (non-empty) clues in a grid — a 0 cell is empty. */
export function countClues(grid: Grid): number {
  let clues = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== 0) clues++;
    }
  }
  return clues;
}

/**
 * Map an engine-generated puzzle to a `daily_puzzles` insert row for a given UTC date under a
 * slot key. Kept pure (no DB, no clock) so both the seed script and the cron can reuse it and so
 * it is unit-testable at the boundary; the caller owns the clock AND the key (the same engine
 * difficulty generates under different keys — e.g. `hard` standard vs. `mini-hard`).
 *
 * Killer/Keisan rows store cages and use the cage count as `clue_count` (they have no givens; the
 * cage count is the analogous display stat). `variant` is derived from the puzzle itself (not the
 * registry), so it is correct even though the roller assigns types to rung-keyed slots.
 */
export function toDailyPuzzleRow(
  puzzle: SudokuPuzzle | KillerPuzzle | CalcPuzzle,
  isoDate: string,
  key: DailyDifficulty,
): NewDailyPuzzle {
  // Real discriminant, not `'cages' in puzzle`: Killer AND Keisan both carry cages, so the old
  // duck-type couldn't tell them apart. Killer/Keisan carry an explicit `variant`; classic doesn't.
  const hasCages = 'variant' in puzzle; // killer or calc — both store cages (sum vs op+target)
  return {
    date: isoDate,
    difficulty: key,
    variant: hasCages ? puzzle.variant : 'classic',
    grid: puzzle.grid,
    solution: puzzle.solution,
    clueCount: hasCages ? puzzle.cages.length : countClues(puzzle.grid),
    cages: hasCages ? puzzle.cages : null,
  };
}

/** Format a `Date` as an ISO `YYYY-MM-DD` string in UTC (the daily rollover zone). */
export function toUtcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Days per month, index 0 = January. February is the leap-year exception handled below. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Proleptic Gregorian leap rule — the one Postgres `date` uses. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * True if `value` is a real calendar date written as `YYYY-MM-DD`.
 *
 * **Shape is not existence, and the difference reached the database.** Every route that takes a
 * `?date=` used to test `/^\d{4}-\d{2}-\d{2}$/`, which accepts `2026-02-31`, `2026-00-10`,
 * `2026-01-32` and `0000-01-01`. Those cleared validation, were interpolated into a `date`
 * comparison, and died at the driver instead — an unhandled 500 (with a stack in the logs) from an
 * input the route had already accepted. Same failure shape as the `time_ms` int4 overflow: a loose
 * check waves the value through and the column rejects it. Measured against the live database
 * before writing this, so each clause below closes an observed 500, not a hypothetical one:
 *
 * - `2026-02-29` → 500, but `2024-02-29` is a genuine day and must stay valid ⇒ real leap rule,
 *   not a flat 29-day February.
 * - `0000-01-01` → 500: there is no year zero in the SQL calendar (1 BC is followed by AD 1), so
 *   years are floored at `0001` rather than at `0000`.
 *
 * Range beyond that is deliberately NOT this function's job — "is it a date?" and "is it a date we
 * have puzzles for?" are separate questions. A valid-but-empty day (`1999-12-31`) still answers
 * with an empty list or a 404, which is the honest response.
 */
export function isIsoDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);

  if (year < 1) return false;
  if (month < 1 || month > 12) return false;

  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= maxDay;
}
