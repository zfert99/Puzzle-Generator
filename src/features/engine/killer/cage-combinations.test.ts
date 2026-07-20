import { describe, expect, it } from 'vitest';
import { candidateMaskExcluding, candidateMaskFor, combosFor, guaranteedMaskFor } from './cage-combinations';

/** Read a bitmask back out as an ascending digit list — makes mask assertions legible. */
function digitsInMask(mask: number): number[] {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (mask & (1 << (d - 1))) digits.push(d);
  }
  return digits;
}

describe('combosFor', () => {
  it('returns the single "magic" combination for extreme 2-cell sums', () => {
    // From the research combination tables: 2-cell unique cages are 3, 4, 16, 17.
    expect(combosFor(2, 3)).toEqual([[1, 2]]);
    expect(combosFor(2, 4)).toEqual([[1, 3]]);
    expect(combosFor(2, 16)).toEqual([[7, 9]]);
    expect(combosFor(2, 17)).toEqual([[8, 9]]);
  });

  it('enumerates all 2-cell combinations for sum 9 (the densest 2-cell sum)', () => {
    // Research: 2-cell counts peak at sum 9 with 4 combinations.
    expect(combosFor(2, 9)).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
  });

  it('matches the research 3-cell unique sums (6 and 24)', () => {
    expect(combosFor(3, 6)).toEqual([[1, 2, 3]]);
    expect(combosFor(3, 24)).toEqual([[7, 8, 9]]);
  });

  it('peaks at 8 combinations for 3-cell sum 15', () => {
    // Research: 3-cell sums peak at 15 with 8 combinations.
    expect(combosFor(3, 15)).toHaveLength(8);
  });

  it('handles the whole-house case: 9 cells summing to 45', () => {
    expect(combosFor(9, 45)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  });

  it('treats a 1-cell cage as a given: the sum IS the only digit', () => {
    // A single-cell cage of sum d can only contain the digit d — a de facto given.
    expect(combosFor(1, 1)).toEqual([[1]]);
    expect(combosFor(1, 7)).toEqual([[7]]);
    expect(combosFor(1, 9)).toEqual([[9]]);
    // ...and a 1-cell cage whose sum isn't a real digit is impossible.
    expect(combosFor(1, 0)).toEqual([]);
    expect(combosFor(1, 10)).toEqual([]);
  });

  it('returns nothing for arithmetically impossible cages', () => {
    expect(combosFor(2, 2)).toEqual([]); // min 2-cell sum is 1+2 = 3
    expect(combosFor(2, 18)).toEqual([]); // max 2-cell sum is 8+9 = 17
    expect(combosFor(3, 5)).toEqual([]); // min 3-cell sum is 1+2+3 = 6
  });

  it('produces every combination in ascending order, with no repeats', () => {
    for (const combo of combosFor(4, 20)) {
      const sorted = [...combo].sort((a, b) => a - b);
      expect(combo).toEqual(sorted); // ascending
      expect(new Set(combo).size).toBe(combo.length); // distinct
    }
  });
});

describe('candidateMaskFor', () => {
  it('packs a single-combination cage into exactly its digits', () => {
    expect(digitsInMask(candidateMaskFor(2, 3))).toEqual([1, 2]);
    expect(digitsInMask(candidateMaskFor(2, 17))).toEqual([8, 9]);
    expect(candidateMaskFor(2, 3)).toBe(0b000000011); // raw bits: {1,2} = 3
  });

  it('unions the digits across all combinations', () => {
    // 2-cell 9 = {1,8},{2,7},{3,6},{4,5} → every digit 1..8 appears, but never 9.
    expect(digitsInMask(candidateMaskFor(2, 9))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('handles a 1-cell cage as the single given digit', () => {
    expect(digitsInMask(candidateMaskFor(1, 7))).toEqual([7]);
  });

  it('is the empty set (0) for an impossible cage', () => {
    expect(candidateMaskFor(2, 18)).toBe(0);
    expect(digitsInMask(candidateMaskFor(2, 18))).toEqual([]);
  });
});

describe('candidateMaskExcluding', () => {
  it('drops digits reachable only through combinations containing a used digit', () => {
    // 2-cell sum 8 = {1,7},{2,6},{3,5}. With 2 already used in the cage, {2,6} is impossible,
    // so 6 must vanish from the mask (the plain union would keep it).
    expect(digitsInMask(candidateMaskExcluding(2, 8, 1 << (2 - 1)))).toEqual([1, 3, 5, 7]);
  });

  it('equals the plain union mask when nothing is used', () => {
    for (let size = 1; size <= 4; size++) {
      for (let sum = 1; sum <= 45; sum++) {
        expect(candidateMaskExcluding(size, sum, 0)).toBe(candidateMaskFor(size, sum));
      }
    }
  });

  it('never returns a used digit and is always a subset of the plain mask', () => {
    for (let sum = 1; sum <= 45; sum++) {
      for (const used of [0b1, 0b10010, 0b100000001]) {
        const mask = candidateMaskExcluding(3, sum, used);
        expect(mask & used).toBe(0);
        expect(mask & candidateMaskFor(3, sum)).toBe(mask);
      }
    }
  });

  it('reads 0 when no disjoint combination exists (prune signal)', () => {
    // 2-cell sum 17 = only {8,9}; with 8 used, no completion exists.
    expect(candidateMaskExcluding(2, 17, 1 << (8 - 1))).toBe(0);
  });

  it('is memo-stable: repeated calls agree (cold vs cached path)', () => {
    const first = candidateMaskExcluding(4, 20, 0b101);
    expect(candidateMaskExcluding(4, 20, 0b101)).toBe(first);
  });
});

describe('guaranteedMaskFor', () => {
  it('forces both digits of a single-combination cage', () => {
    expect(digitsInMask(guaranteedMaskFor(2, 17))).toEqual([8, 9]);
    expect(digitsInMask(guaranteedMaskFor(2, 3))).toEqual([1, 2]);
  });

  it('finds the digit common to every combination (research 4-cell 13 → 1)', () => {
    // {1,2,3,7},{1,2,4,6},{1,3,4,5} all contain a 1.
    expect(digitsInMask(guaranteedMaskFor(4, 13))).toEqual([1]);
  });

  it('forces nothing when combinations share no digit', () => {
    // 2-cell 9 = {1,8},{2,7},{3,6},{4,5} — the union is {1..8}, the intersection is empty.
    expect(guaranteedMaskFor(2, 9)).toBe(0);
  });

  it('is a SUBSET of the candidate (union) mask — guaranteed implies possible', () => {
    for (let sum = 1; sum <= 45; sum++) {
      const guaranteed = guaranteedMaskFor(3, sum);
      const candidate = candidateMaskFor(3, sum);
      // every bit set in `guaranteed` must also be set in `candidate`
      expect(guaranteed & candidate).toBe(guaranteed);
    }
  });
});

describe('the precomputed table (compute-once + immutability)', () => {
  it('returns the SAME cached instance on repeated calls', () => {
    // Now that results are cached, two calls hand back the identical object.
    // `toBe` is reference equality (===) — this would FAIL before memoization,
    // when every call built a fresh array.
    expect(combosFor(3, 15)).toBe(combosFor(3, 15));
  });

  it('hands out frozen arrays that cannot be mutated', () => {
    const combos = combosFor(2, 9);
    expect(Object.isFrozen(combos)).toBe(true);
    expect(() => (combos as number[][]).push([9, 9])).toThrow();
  });

  it('never breaks the shared table even if a caller tries to mutate a result', () => {
    // Because the inner arrays are frozen too, a rogue sort can't corrupt the cache.
    const first = combosFor(2, 9);
    expect(() => (first[0] as number[]).sort()).toThrow();
    expect(digitsInMask(candidateMaskFor(2, 9))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
