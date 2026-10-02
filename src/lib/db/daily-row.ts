import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import type { KakuroPuzzle } from '@/features/engine/kakuro/kakuro-types';
import { GUTTER_SIDES, type SkyscraperClues, type SkyscrapersPuzzle } from '@/features/engine/skyscrapers/skyscrapers-types';
import type { DailyVariant, Grid, NewDailyPuzzle, StoredCage, StoredSkyscraperClue } from './schema';

/**
 * The daily registry — **type-as-slot** model. One daily slot per puzzle TYPE with the
 * DIFFICULTY randomized, replacing the old flat 30-board `DAILY_BOARDS` wall. See
 * `Docs/daily-redesign-plan.md`. Two data structures:
 *
 * - **Slots** — what the cron generates each day: standard slots keyed by difficulty RUNG
 *   (`easy…extreme`, one per type — at five types every rung is drawn, a bijection) + mini slots
 *   keyed `mini-<tier>` (always 3; 3 of the 5 types roll into them — Kakuro plan D4). The TYPE is
 *   rolled per day and stored in `daily_puzzles.variant` — the key no longer encodes it. Sizes
 *   are **per type** (Kakuro plan D11): `SIZES[variant]` says which mini sizes a type ships and
 *   which size is its standard — 9×9 for four types, **6×6 for Skyscrapers** (Skyscrapers plan D5,
 *   the first non-9×9 standard), so a section is never read off the grid size alone
 *   (`sectionForKey`).
 * - **Profile table** (`PROFILE`) — per `(variant, size, difficulty)`: `minSolveMs` (anti-cheat
 *   plausibility floor, see `solve-rules.md`) and `botTimeMs` (Puzzle Bot's beatable time). Values
 *   moved verbatim from the old registry + the new `(killer,4,easy)` row.
 *
 * The old per-string keys (`killer-*`, `calc*`, `mini4-*`, `mini6-*`, `killer6-*`, legacy `killer`)
 * are **retired from generation** but stay valid for archive replay (see `LEGACY_KEYS` /
 * `isDailyDifficulty`); historical rows carry their backfilled `variant` (migration `0004`).
 */

/** Puzzle type — the stored `daily_puzzles.variant`; the union lives with the column (`schema.ts`). */
export type Variant = DailyVariant;
/** The five standard difficulty rungs. Standard slots are keyed by these. */
export type StandardRung = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';
/** Mini difficulties — the 3-tier ladder (no expert/extreme minis). */
export type MiniTier = 'easy' | 'medium' | 'hard';
/** A grid size some daily type ships; which type ships which is `SIZES` (D11). */
export type DailySize = 4 | 5 | 6 | 9;

/**
 * Any daily key routes accept. Kept as `string` because keys are now data-driven (slot keys +
 * retired legacy keys for archive); `isDailyDifficulty` is the runtime validator.
 */
export type DailyDifficulty = string;

export const VARIANTS: readonly Variant[] = ['classic', 'killer', 'calc', 'kakuro', 'skyscrapers'];

/**
 * The sizes each type ships in the daily (Kakuro plan D11: sizes are per type, not the inherited
 * 4/6/9). The Sudoku family keeps `{ mini: [4, 6], standard: 9 }`, so nothing it does changes;
 * Kakuro's mini is the 6×6 (D6′ — its 7×7 is a `/play` size, not a daily one). **Skyscrapers'
 * standard is the 6×6** (Skyscrapers plan D5, owner's call 2026-10-02): it is the only Skyscrapers
 * size that offers all five rungs (E5's tier sets — the 5×5 tops out at hard, the 7×7 has no
 * easy), and a standard slot must cover the whole ladder for the roll's bijection; its mini is the
 * 5×5. A mini slot's easy/medium board is played at the type's *smallest* mini size and its hard
 * board at a size rolled from the type's list — for the Sudoku family that is exactly the old
 * "easy/medium = 4×4, hard = random(4/6)" rule.
 */
export const SIZES: Record<Variant, { readonly mini: readonly DailySize[]; readonly standard: DailySize }> = {
  classic: { mini: [4, 6], standard: 9 },
  killer: { mini: [4, 6], standard: 9 },
  calc: { mini: [4, 6], standard: 9 },
  kakuro: { mini: [6], standard: 9 },
  skyscrapers: { mini: [5], standard: 6 },
};

/**
 * Is this string one of the daily's registered variants? The board store's `PuzzleVariant` and
 * the registry's `Variant` agree (Kakuro joined the daily in its R1, Skyscrapers in its R1); the
 * guard stays because a surface that labels a board from the store narrows with it rather than an
 * assertion.
 */
export function isDailyVariant(value: string): value is Variant {
  return (VARIANTS as readonly string[]).includes(value);
}
export const STANDARD_RUNGS: readonly StandardRung[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];
const MINI_TIERS: readonly MiniTier[] = ['easy', 'medium', 'hard'];
/** The prefix every active mini key carries — the one string `sectionForKey` and the SQL section rule share. */
export const MINI_KEY_PREFIX = 'mini-';
/** Mini slot keys, one per tier. The type they hold is rolled per day. */
export const MINI_KEYS: Record<MiniTier, string> = {
  easy: `${MINI_KEY_PREFIX}easy`,
  medium: `${MINI_KEY_PREFIX}medium`,
  hard: `${MINI_KEY_PREFIX}hard`,
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
  // ---- Kakuro 9×9 (Kakuro plan R1) — ESTIMATES derived from cell count, not telemetry (G2):
  // a repaired 9×9 has ~50 white cells; the record pace anecdotally sits near 0.8 s/cell, so the
  // floors sit well below that (≈ 0.4–1 s/cell) and the bot near a typical skilled pace (hard
  // 9×9 ≈ 10+ min). Tune from live attempts once they exist.
  'kakuro-9-easy': { minSolveMs: 20_000, botTimeMs: 300_000 },
  'kakuro-9-medium': { minSolveMs: 25_000, botTimeMs: 480_000 },
  'kakuro-9-hard': { minSolveMs: 30_000, botTimeMs: 720_000 },
  'kakuro-9-expert': { minSolveMs: 40_000, botTimeMs: 1_080_000 },
  'kakuro-9-extreme': { minSolveMs: 50_000, botTimeMs: 1_500_000 },
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
  // Kakuro's only mini is the 6×6 (~22 white cells) — the same estimate rule as its 9×9 rows.
  'kakuro-6-easy': { minSolveMs: 6_000, botTimeMs: 60_000 },
  'kakuro-6-medium': { minSolveMs: 8_000, botTimeMs: 100_000 },
  'kakuro-6-hard': { minSolveMs: 10_000, botTimeMs: 150_000 },
  // ---- Skyscrapers (Skyscrapers plan R1) — ESTIMATES from cell count, not telemetry (G6): the
  // only public numbers are a ~3.4–4.5 s hall-of-fame on small easy grids and GM Puzzles'
  // 9–36 min "very hard" 6×6. The **6×6 standard** (36 cells, no givens) floors sit well below
  // record pace (≈ 0.2–0.5 s/cell) and the bot near a typical skilled pace; the 5×5 mini (25 cells)
  // scales down. Tune from live attempts once they exist.
  'skyscrapers-6-easy': { minSolveMs: 8_000, botTimeMs: 90_000 },
  'skyscrapers-6-medium': { minSolveMs: 10_000, botTimeMs: 150_000 },
  'skyscrapers-6-hard': { minSolveMs: 12_000, botTimeMs: 240_000 },
  'skyscrapers-6-expert': { minSolveMs: 15_000, botTimeMs: 360_000 },
  'skyscrapers-6-extreme': { minSolveMs: 20_000, botTimeMs: 600_000 },
  'skyscrapers-5-easy': { minSolveMs: 4_000, botTimeMs: 45_000 },
  'skyscrapers-5-medium': { minSolveMs: 5_000, botTimeMs: 70_000 },
  'skyscrapers-5-hard': { minSolveMs: 6_000, botTimeMs: 110_000 },
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
 * Whether a `(variant, size, difficulty)` is a real daily board. Standard = every type at **its**
 * standard size (9×9 for four types, 6×6 for Skyscrapers — D5) on all five rungs. Minis = 3-tier
 * only, at a size the type ships (`SIZES`): classic/calc at 4×4 and 6×6, Kakuro at 6×6 only,
 * Skyscrapers at 5×5 only; **Killer is easy-only at 4×4** (de-risked — tiers collapse to tier-1 on
 * a 16-cell no-givens grid) but full e/m/h at 6×6.
 */
export function isEligible(variant: Variant, gridSize: DailySize, difficulty: StandardRung): boolean {
  if (gridSize === SIZES[variant].standard) return true;
  if (!SIZES[variant].mini.includes(gridSize)) return false;
  if (difficulty === 'expert' || difficulty === 'extreme') return false; // no expert/extreme minis
  if (variant === 'killer') return gridSize === 4 ? difficulty === 'easy' : true;
  return true;
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

/**
 * Which section a stored board belongs to. The **key** decides for active boards (a bare rung is
 * standard, `mini-*` is a mini); the grid size is only the fallback for retired keys, whose
 * prefixes lie (`mini4-*`, `killer6-*`, `calc4-*` are minis without a `mini-` prefix) but whose
 * standards were all 9×9. Size alone stopped being the rule when Skyscrapers brought the first
 * **6×6 standard** (D5): "smaller than 9×9 ⇒ mini" would file a `hard` Skyscrapers under the
 * minis. Every surface that files a board — `/api/daily/slots`, the playing label, the continue
 * banner, the archive progress aggregate — uses this one rule.
 */
export function sectionForKey(key: string, gridSize: number): 'standard' | 'mini' {
  if ((STANDARD_RUNGS as readonly string[]).includes(key)) return 'standard';
  if (key.startsWith(MINI_KEY_PREFIX)) return 'mini';
  return gridSize < 9 ? 'mini' : 'standard';
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

/** Every ordered pick of `k` distinct items — the ways to seat types into the mini slots. */
function permutationsOf<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, i) =>
    permutationsOf([...items.slice(0, i), ...items.slice(i + 1)], k - 1).map((rest) => [item, ...rest])
  );
}

/**
 * Every valid mini configuration for a set of types: each ordered pick of `MINI_TIERS.length`
 * types seated into the easy/medium/hard slots, the easy and medium boards at the type's
 * smallest mini size and the hard board at each size the type ships, filtered by `isEligible`.
 * For the Sudoku family this is exactly the pre-D4 enumeration (6 permutations × hard ∈ {4, 6});
 * exported so the roller test can assert that restriction reproduces the old set.
 */
export function miniConfigurations(types: readonly Variant[]): { variant: Variant; gridSize: DailySize; difficulty: MiniTier }[][] {
  const configs: { variant: Variant; gridSize: DailySize; difficulty: MiniTier }[][] = [];
  for (const seating of permutationsOf(types, MINI_TIERS.length)) {
    const hardType = seating[MINI_TIERS.length - 1];
    for (const hardSize of SIZES[hardType].mini) {
      const assignment = seating.map((variant, slotIdx) => ({
        variant,
        gridSize: slotIdx === MINI_TIERS.length - 1 ? hardSize : SIZES[variant].mini[0],
        difficulty: MINI_TIERS[slotIdx],
      }));
      if (assignment.every((a) => isEligible(a.variant, a.gridSize, a.difficulty))) configs.push(assignment);
    }
  }
  return configs;
}

/**
 * Roll one day's assignment: a valid, distinct set of daily slots. Pure (RNG injected) so the
 * cron and tests share it. Returns one standard slot per type + 3 mini slots — **5 + 3 = 8** at
 * five types (the daily plan's end state; 4 + 3 at four, Kakuro plan D4).
 *
 * - **Standard:** draw `VARIANTS.length` distinct rungs of the 5, assign one to each type — at
 *   five types a **bijection**: every rung is played every day, by a different type. Every type
 *   covers the full standard ladder at its own standard size (Skyscrapers at 6×6 — D5), so any
 *   pairing is valid; keys are the rungs → distinct.
 * - **Minis:** enumerate every valid seating of 3 of the N types into the three tier slots, with
 *   the hard slot's size rolled from the seated type's mini sizes (`miniConfigurations`); pick a
 *   seating uniformly, then a hard size uniformly within it. Two types sit out the minis each
 *   day at five types. This still guarantees Killer only ever lands on easy-4×4 or a 6×6 hard
 *   slot, Kakuro only on 6×6, and Skyscrapers only on 5×5.
 */
export function rollDailyAssignment(rng: () => number = Math.random): PlannedSlot[] {
  const rungs = shuffle(STANDARD_RUNGS, rng).slice(0, VARIANTS.length);
  const types = shuffle(VARIANTS, rng);
  const standard: PlannedSlot[] = rungs.map((difficulty, i) => ({
    key: difficulty,
    section: 'standard',
    variant: types[i],
    gridSize: SIZES[types[i]].standard,
    difficulty,
  }));

  // Two draws, not one uniform pick over configurations: a configuration is a seating × a hard
  // size, so a type with two mini sizes would otherwise be twice as likely in the hard seat as a
  // type with one (Kakuro) — a review finding on R1. Draw the seating uniformly, then the hard
  // size uniformly among that seating's valid sizes.
  const bySeating = new Map<string, ReturnType<typeof miniConfigurations>>();
  for (const config of miniConfigurations(VARIANTS)) {
    const seating = config.map((a) => a.variant).join('>');
    bySeating.set(seating, [...(bySeating.get(seating) ?? []), config]);
  }
  const seatings = [...bySeating.values()];
  const seated = seatings[Math.floor(rng() * seatings.length)];
  const chosen = seated[Math.floor(rng() * seated.length)];
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
  puzzle: SudokuPuzzle | KillerPuzzle | CalcPuzzle | KakuroPuzzle | SkyscrapersPuzzle,
  isoDate: string,
  key: DailyDifficulty,
): NewDailyPuzzle {
  // Real discriminant, not `'cages' in puzzle`: Killer AND Keisan both carry cages, so the old
  // duck-type couldn't tell them apart. Killer/Keisan/Kakuro/Skyscrapers carry an explicit
  // `variant`; classic doesn't. A Kakuro's RUNS and a Skyscrapers' edge CLUES ride the `cages`
  // column (the jsonb grab-bag `variant` gates — Kakuro D2/D3, Skyscrapers D2), each with its
  // own count as the display stat.
  if (!('variant' in puzzle)) {
    return { date: isoDate, difficulty: key, variant: 'classic', grid: puzzle.grid, solution: puzzle.solution, clueCount: countClues(puzzle.grid), cages: null };
  }
  const stored: StoredCage[] = puzzle.variant === 'kakuro' ? puzzle.runs : puzzle.variant === 'skyscrapers' ? storeSkyscraperClues(puzzle.clues) : puzzle.cages;
  return {
    date: isoDate,
    difficulty: key,
    variant: puzzle.variant,
    grid: puzzle.grid,
    solution: puzzle.solution,
    clueCount: stored.length,
    cages: stored,
  };
}

/**
 * A Skyscrapers clue set as the `cages` column stores it: one entry per **present** clue, so the
 * entry count is the clue count (the display stat) and a blank is simply absent (Skyscrapers D2).
 */
export function storeSkyscraperClues(clues: SkyscraperClues): StoredSkyscraperClue[] {
  const stored: StoredSkyscraperClue[] = [];
  for (const side of GUTTER_SIDES) {
    clues[side].forEach((count, index) => {
      if (count > 0) stored.push({ side, index, count });
    });
  }
  return stored;
}

/**
 * The inverse of `storeSkyscraperClues`: four length-`size` arrays with 0 for every absent clue.
 * A stored entry with an unknown side or an out-of-range index is skipped, not thrown on — the
 * column is persisted data the serving route must survive (the E1 lesson about corrupt saves).
 */
export function restoreSkyscraperClues(stored: readonly StoredSkyscraperClue[], size: number): SkyscraperClues {
  const clues: SkyscraperClues = { top: Array(size).fill(0), bottom: Array(size).fill(0), left: Array(size).fill(0), right: Array(size).fill(0) };
  for (const { side, index, count } of stored) {
    if (!(GUTTER_SIDES as readonly string[]).includes(side)) continue;
    if (index >= 0 && index < size) clues[side][index] = count;
  }
  return clues;
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

/**
 * True if `value` is a real `YYYY-MM` month — `isIsoDate`'s contract, one axis shorter.
 *
 * Exists so routes taking a `?month=` (`/api/me/progress`, `/api/daily/days`) share one
 * definition instead of each carrying its own regex that forgets an edge. Month `00`/`13` and
 * year `0000` are rejected for the same reason `isIsoDate` rejects them: Postgres can build no
 * date inside them, so a shape-only match becomes a driver 500 one layer down.
 */
export function isIsoMonth(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})$/.exec(value);
  if (!parts) return false;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  return year >= 1 && month >= 1 && month <= 12;
}

/**
 * First day of the month AFTER `month` (`YYYY-MM`), as an ISO date string — the exclusive upper
 * bound for "everything in this month" range queries.
 *
 * **Why string arithmetic instead of `Date`.** The obvious spelling,
 * `new Date(Date.UTC(year, month0 + 1, 1))`, is wrong at both ends of the range `isIsoMonth`
 * accepts: `Date.UTC` maps years 0–99 onto 1900–1999 (so `0050-03` would silently query April
 * 1950), and `9999-12` formats as the extended-year string `+010000-01-01`, which Postgres
 * rejects. Neither is reachable with real data — the archive starts in 2026 — but "the helper is
 * correct except at the edges the validator allows" is exactly the bug shape `isIsoDate` exists
 * to kill. Digits in, digits out: no calendar arithmetic, no era mapping.
 *
 * Day 1 of the next month always exists, which is why callers bound with
 * `< firstDayOfNextMonth(month)` rather than `<= lastDayOfMonth` — the latter composes invalid
 * literals for short months (`2026-02-31`) unless it carries its own month-length table.
 */
export function firstDayOfNextMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return monthNumber === 12
    ? `${String(year + 1).padStart(4, '0')}-01-01`
    : `${month.slice(0, 4)}-${String(monthNumber + 1).padStart(2, '0')}-01`;
}
