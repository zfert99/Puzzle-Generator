/**
 * Cage-combination enumeration — the arithmetic core of Killer Sudoku.
 *
 * A Killer cage is a group of `size` cells that must sum to a target `sum`, using
 * DISTINCT digits 1–9 (the no-repeat-in-cage convention). This module answers the one
 * question every Killer deduction depends on: which digit sets are possible for a given
 * (size, sum)? Cages with exactly one possible set ("magic cages", e.g. 2 cells = 17 →
 * {8,9}) are the entry points a solve bootstraps from.
 *
 * Because the (size, sum) space is tiny and fixed (9 sizes × 45 sums), every answer is
 * precomputed ONCE at module load into a frozen lookup table; `combosFor`/`candidateMaskFor`
 * are then constant-time reads. See `cage-combinations.md` for the "why".
 */

const MAX_DIGIT = 9;
const MAX_SUM = 45; // 1 + 2 + … + 9
const ALL_DIGITS_MASK = (1 << MAX_DIGIT) - 1; // 0b111111111 — every digit on

/**
 * Digit counts we build tables for — 9 (classic), 6 (6×6 Killer, digits 1–6, Rule of 21), and
 * 4 (the exact solver is size-generic and its 4×4 tests exercise it).
 * The tables MUST be per-digit-count: reusing 9-digit tables on a 6×6 admits false candidates
 * (2-cell sum 8 keeps digit 1 via the 9-digit combo {1,7} though no 6×6 combo contains a 1),
 * and magic-cage / foothold detection miscounts (see the grid-sizes research).
 */
const SUPPORTED_DIGITS = [4, 6, 9] as const; // 4×4 kept for the size-generic exact solver

/** An ascending set of distinct digits, e.g. `[1, 8]`. Shared from the frozen table — immutable. */
export type Combination = readonly number[];
/** All combinations for one (size, sum), e.g. every pair summing to 9. */
type CombinationList = readonly Combination[];
/** Combination lists for a fixed size, indexed by `sum`. */
type SumRow = readonly CombinationList[];
/** The whole precomputed table, indexed by `size` then `sum`. */
type ComboTable = readonly SumRow[];

/**
 * The pure recursive enumerator. Private: callers use `combosFor`, which reads the
 * precomputed table this feeds. Builds combinations by choosing digits in strictly
 * increasing order, which guarantees no repeats and no duplicate sets for free.
 */
function enumerate(size: number, sum: number, maxDigit: number): number[][] {
  const results: number[][] = [];
  const current: number[] = [];

  const walk = (start: number, remainingCount: number, remainingSum: number): void => {
    if (remainingCount === 0) {
      if (remainingSum === 0) results.push([...current]);
      return;
    }
    for (let digit = start; digit <= maxDigit; digit++) {
      // Digits only grow from here, so once one overshoots the remaining target, every
      // larger one does too — abandon this branch.
      if (digit > remainingSum) break;
      current.push(digit);
      walk(digit + 1, remainingCount - 1, remainingSum - digit);
      current.pop();
    }
  };

  walk(1, size, sum);
  return results;
}

/** Turn one combination into a bitmask (bit `d-1` set for each digit `d` it contains). */
function bitsOf(combo: Combination): number {
  let mask = 0;
  for (const digit of combo) mask |= 1 << (digit - 1);
  return mask;
}

/** Union a list of combinations: digits that appear in ANY of them (`|`). */
function unionMaskOf(combos: CombinationList): number {
  let mask = 0;
  for (const combo of combos) mask |= bitsOf(combo);
  return mask;
}

/** Intersect a list of combinations: digits that appear in EVERY one (`&`). Empty list → 0. */
function guaranteedMaskOf(combos: CombinationList): number {
  if (combos.length === 0) return 0;
  let mask = ALL_DIGITS_MASK;
  for (const combo of combos) mask &= bitsOf(combo);
  return mask;
}

/** Recursively freeze an array and everything inside it, so no nested level can be mutated. */
function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

/**
 * Precompute every (size, sum) once at module load, deeply frozen so a caller can never
 * mutate a shared cached array. Indexed `[size][sum]`; out-of-range slots read as the shared
 * empty list. (A mutable array is assignable to its `readonly` view, so no cast is needed.)
 */
const EMPTY: CombinationList = deepFreeze([]);

/** One full table set per supported digit count, indexed by digit count then [size][sum]. */
const COMBO_TABLES: Record<number, ComboTable> = {};
const MASK_TABLES: Record<number, readonly (readonly number[])[]> = {};
const COMBO_MASK_TABLES: Record<number, readonly (readonly (readonly number[])[])[]> = {};
const GUARANTEED_TABLES: Record<number, readonly (readonly number[])[]> = {};
for (const digits of SUPPORTED_DIGITS) {
  const table: ComboTable = deepFreeze(
    Array.from({ length: MAX_DIGIT + 1 }, (_, size) =>
      Array.from({ length: MAX_SUM + 1 }, (_, sum) => enumerate(size, sum, digits)),
    ),
  );
  COMBO_TABLES[digits] = table;
  MASK_TABLES[digits] = deepFreeze(table.map((sumRow) => sumRow.map((combos) => unionMaskOf(combos))));
  // Each combination pre-packed as a bitmask, aligned with the combo table — one array read +
  // bit-and per combination lets `candidateMaskExcluding` filter without touching digit arrays.
  COMBO_MASK_TABLES[digits] = deepFreeze(
    table.map((sumRow) => sumRow.map((combos) => combos.map((combo) => bitsOf(combo)))),
  );
  GUARANTEED_TABLES[digits] = deepFreeze(table.map((sumRow) => sumRow.map((combos) => guaranteedMaskOf(combos))));
}

/**
 * Every set of `size` DISTINCT digits from 1–9 that sums to `sum` (a constant-time lookup
 * into the frozen table). Each combination is ascending; the list is ascending. Returns the
 * shared empty array for an impossible or out-of-range cage.
 *
 * The result is FROZEN and shared — never mutate it (copy first, e.g. `[...combo]`).
 *
 * @example
 * combosFor(2, 3)  // [[1, 2]]              — a "magic" cage: only one option
 * combosFor(2, 9)  // [[1,8],[2,7],[3,6],[4,5]]
 * combosFor(2, 17) // [[8, 9]]
 */
export function combosFor(size: number, sum: number, maxDigit = 9): readonly Combination[] {
  return COMBO_TABLES[maxDigit]?.[size]?.[sum] ?? EMPTY;
}

/**
 * The set of digits that can appear in ANY combination for a (size, sum), packed as a
 * bitmask: bit `(d - 1)` is set iff digit `d` is possible somewhere in such a cage (a
 * constant-time lookup). This is the union across every combination; `0` means impossible.
 *
 * The exact solver intersects this against a cell's own candidates to prune.
 *
 * @example
 * candidateMaskFor(2, 3)  // 0b000000011  = {1,2}
 * candidateMaskFor(2, 9)  // 0b011111111  = {1..8}  (no pair summing to 9 uses a 9)
 * candidateMaskFor(2, 17) // 0b110000000  = {8,9}
 */
export function candidateMaskFor(size: number, sum: number, maxDigit = 9): number {
  return MASK_TABLES[maxDigit]?.[size]?.[sum] ?? 0;
}

/**
 * The set of digits that appear in EVERY combination for a (size, sum) — i.e. digits
 * *guaranteed* to sit somewhere in such a cage — packed as a bitmask (constant-time lookup).
 * This is the intersection across all combinations; `0` means nothing is forced.
 *
 * The solver uses it for the research's "consistent-digit" deduction: a guaranteed digit must
 * live in the cage, so it can be eliminated from every other cell in the cage's houses.
 *
 * @example
 * guaranteedMaskFor(2, 17) // {8,9}  — a single-combination cage forces both digits
 * guaranteedMaskFor(4, 13) // {1}    — {1,2,3,7},{1,2,4,6},{1,3,4,5} all contain a 1
 * guaranteedMaskFor(2, 9)  // 0      — the four pairs share no common digit
 */
export function guaranteedMaskFor(size: number, sum: number, maxDigit = 9): number {
  return GUARANTEED_TABLES[maxDigit]?.[size]?.[sum] ?? 0;
}

/**
 * Like `candidateMaskFor`, but only over combinations DISJOINT from `usedMask` (digits already
 * placed in the cage). This is the E1/P1 pruning fix: the plain union admits digits that
 * appear only in combinations containing an already-used digit — dead branches the plain mask
 * lets the exact solver explore. Measured on maxSize-4 no-givens layouts, that difference is
 * the bulk of the solver's thrash (see `killer-expert-implementation-plan.md`).
 *
 * The result never contains `usedMask` digits (a disjoint combination can't contribute them),
 * so callers don't need an extra `& ~used`. `0` means no completion exists — prune the branch.
 * Linear scan over ≤ 12 precomputed masks; no memo needed (measured).
 *
 * @example
 * candidateMaskFor(2, 8)                    // {1,2,3,5,6,7}   ({2,6} included)
 * candidateMaskExcluding(2, 8, 1 << (2-1))  // {1,3,5,7}       (2 used → {2,6} filtered out)
 */
// Lazy memo for `candidateMaskExcluding`: flat (size, sum, used) → mask. 10 × 46 × 512
// Int32 entries ≈ 940 KB, −1 = unfilled (0 is a real "impossible" answer). Measured: the
// unmemoized ≤12-mask scan ran on every `candidates()` call of every search node and cost
// MORE than the pruning saved (~3× slower verify); memoized it is an array read after warmup.
const EXCLUDING_MEMOS: Record<number, Int32Array> = {
  4: new Int32Array(10 * (MAX_SUM + 1) * (1 << 4)).fill(-1),
  6: new Int32Array(10 * (MAX_SUM + 1) * (1 << 6)).fill(-1),
  9: new Int32Array(10 * (MAX_SUM + 1) * (1 << MAX_DIGIT)).fill(-1),
};

export function candidateMaskExcluding(size: number, sum: number, usedMask: number, maxDigit = 9): number {
  if (size < 0 || size > MAX_DIGIT || sum < 0 || sum > MAX_SUM) return 0;
  const memo = EXCLUDING_MEMOS[maxDigit];
  const key = (size * (MAX_SUM + 1) + sum) * (1 << maxDigit) + usedMask;
  const cached = memo[key];
  if (cached !== -1) return cached;
  const comboMasks = COMBO_MASK_TABLES[maxDigit][size][sum];
  let mask = 0;
  for (const comboMask of comboMasks) {
    if ((comboMask & usedMask) === 0) mask |= comboMask;
  }
  memo[key] = mask;
  return mask;
}
