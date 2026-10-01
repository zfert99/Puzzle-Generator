import { describe, expect, it } from 'vitest';
import {
  ALL_DIGITS_MASK,
  digitsToMask,
  isUniqueCombination,
  runCandidateMask,
  runComboMasks,
  runCombos,
  runGuaranteedMask,
} from './kakuro-combinations';

describe('the (length, sum) table at 9 digits', () => {
  it('has the expected number of combinations per run length (sum of 2^9 − 1 = 511)', () => {
    const perLength = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((length) => {
      let total = 0;
      for (let sum = 1; sum <= 45; sum++) total += runCombos(length, sum).length;
      return total;
    });
    expect(perLength).toEqual([9, 36, 84, 126, 126, 84, 36, 9, 1]);
    expect(perLength.reduce((a, b) => a + b, 0)).toBe(511);
  });

  it('covers exactly the possible sum range for each length', () => {
    // Min sum = 1+2+…+L, max sum = 9+8+…+(10−L). Nothing outside, nothing missing inside.
    for (let length = 2; length <= 9; length++) {
      const min = (length * (length + 1)) / 2;
      const max = (length * (19 - length)) / 2;
      for (let sum = 0; sum <= 46; sum++) {
        expect(runCombos(length, sum).length > 0, `L=${length} S=${sum}`).toBe(sum >= min && sum <= max);
      }
    }
  });

  it('knows the canonical magic runs', () => {
    expect(runCombos(2, 3)).toEqual([[1, 2]]);
    expect(runCombos(2, 4)).toEqual([[1, 3]]);
    expect(runCombos(2, 16)).toEqual([[7, 9]]);
    expect(runCombos(2, 17)).toEqual([[8, 9]]);
    expect(runCombos(3, 6)).toEqual([[1, 2, 3]]);
    expect(runCombos(3, 7)).toEqual([[1, 2, 4]]);
    expect(runCombos(3, 23)).toEqual([[6, 8, 9]]);
    expect(runCombos(3, 24)).toEqual([[7, 8, 9]]);
    expect(runCombos(4, 10)).toEqual([[1, 2, 3, 4]]);
    expect(runCombos(4, 30)).toEqual([[6, 7, 8, 9]]);
    expect(runCombos(9, 45)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
    expect(isUniqueCombination(2, 17)).toBe(true);
    expect(isUniqueCombination(2, 9)).toBe(false);
  });
});

describe('masks', () => {
  it('packs digits with bit (d − 1), the engine-wide convention', () => {
    expect(digitsToMask([1])).toBe(0b1);
    expect(digitsToMask([8, 9])).toBe(0b110000000);
    expect(digitsToMask([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(ALL_DIGITS_MASK);
  });

  it('gives union, intersection and per-combination masks that agree with the digit lists', () => {
    expect(runCandidateMask(2, 9)).toBe(digitsToMask([1, 2, 3, 4, 5, 6, 7, 8])); // no pair to 9 uses a 9
    expect(runGuaranteedMask(2, 17)).toBe(digitsToMask([8, 9]));
    expect(runGuaranteedMask(4, 13)).toBe(digitsToMask([1])); // {1,2,3,7},{1,2,4,6},{1,3,4,5}
    expect(runComboMasks(2, 9)).toEqual([
      digitsToMask([1, 8]),
      digitsToMask([2, 7]),
      digitsToMask([3, 6]),
      digitsToMask([4, 5]),
    ]);
    expect(runComboMasks(2, 9)).toBe(runComboMasks(2, 9)); // memoized — same frozen array
  });
});
