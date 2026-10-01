/**
 * The Kakuro combination table: for a run of `length` cells summing to `sum`, which sets of
 * distinct digits 1–9 are possible?
 *
 * This IS Killer Sudoku's cage-combination question at `maxDigit = 9` — a Kakuro run is a
 * Killer cage without the house constraint — so the table is not built twice: everything here
 * is a thin, Kakuro-named view over `killer/cage-combinations.ts`, plus the bitmask form the
 * solver works in. See `kakuro-combinations.md` for why masks.
 */

import { candidateMaskFor, combosFor, guaranteedMaskFor, type Combination } from '../killer/cage-combinations';

/** Every digit 1–9 on: bit `(d - 1)` is digit `d`, the convention the whole engine shares. */
export const ALL_DIGITS_MASK = 0b111111111;

/** The digits of a combination packed as a bitmask. */
export function digitsToMask(digits: readonly number[]): number {
  let mask = 0;
  for (const digit of digits) mask |= 1 << (digit - 1);
  return mask;
}

/** Every set of `length` distinct digits summing to `sum`, each ascending; empty if impossible. */
export function runCombos(length: number, sum: number): readonly Combination[] {
  return combosFor(length, sum, 9);
}

/** A run has a unique combination ("magic run", e.g. 17-in-two = {8,9}) — the easiest deduction. */
export function isUniqueCombination(length: number, sum: number): boolean {
  return runCombos(length, sum).length === 1;
}

/** The union of every combination's digits for a (length, sum), as a mask; 0 if impossible. */
export function runCandidateMask(length: number, sum: number): number {
  return candidateMaskFor(length, sum, 9);
}

/** The digits common to every combination for a (length, sum) — guaranteed somewhere in the run. */
export function runGuaranteedMask(length: number, sum: number): number {
  return guaranteedMaskFor(length, sum, 9);
}

const COMBO_MASKS = new Map<number, readonly number[]>();

/**
 * The combinations for a (length, sum) as bitmasks, memoized. The solver filters a run's
 * combinations against its cells' candidate masks on every propagation step, and a mask
 * compares in one AND where a digit list would need a loop.
 */
export function runComboMasks(length: number, sum: number): readonly number[] {
  const key = length * 64 + sum;
  let masks = COMBO_MASKS.get(key);
  if (masks === undefined) {
    masks = Object.freeze(runCombos(length, sum).map(digitsToMask));
    COMBO_MASKS.set(key, masks);
  }
  return masks;
}
