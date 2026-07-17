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
function enumerate(size: number, sum: number): number[][] {
  const results: number[][] = [];
  const current: number[] = [];

  const walk = (start: number, remainingCount: number, remainingSum: number): void => {
    if (remainingCount === 0) {
      if (remainingSum === 0) results.push([...current]);
      return;
    }
    for (let digit = start; digit <= MAX_DIGIT; digit++) {
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

const COMBO_TABLE: ComboTable = deepFreeze(
  Array.from({ length: MAX_DIGIT + 1 }, (_, size) =>
    Array.from({ length: MAX_SUM + 1 }, (_, sum) => enumerate(size, sum)),
  ),
);

const MASK_TABLE: readonly (readonly number[])[] = deepFreeze(
  COMBO_TABLE.map((sumRow) => sumRow.map((combos) => unionMaskOf(combos))),
);

const GUARANTEED_TABLE: readonly (readonly number[])[] = deepFreeze(
  COMBO_TABLE.map((sumRow) => sumRow.map((combos) => guaranteedMaskOf(combos))),
);

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
export function combosFor(size: number, sum: number): readonly Combination[] {
  return COMBO_TABLE[size]?.[sum] ?? EMPTY;
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
export function candidateMaskFor(size: number, sum: number): number {
  return MASK_TABLE[size]?.[sum] ?? 0;
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
export function guaranteedMaskFor(size: number, sum: number): number {
  return GUARANTEED_TABLE[size]?.[sum] ?? 0;
}
