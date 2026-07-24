// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  kenkenCombosFor,
  kenkenUnionMask,
  kenkenGuaranteedMask,
  _clearKenKenComboMemo,
  type Multiset,
} from './kenken-combinations';

/** Normalize a list of multisets to a comparable, order-independent form. */
function normalize(combos: readonly Multiset[]): string[] {
  return combos.map((c) => [...c].sort((a, b) => a - b).join(',')).sort();
}

/** Build a digit-set bitmask from a plain digit list, for asserting masks. */
function maskOf(...digits: number[]): number {
  let m = 0;
  for (const d of digits) m |= 1 << (d - 1);
  return m;
}

describe('kenkenCombosFor — addition', () => {
  it('includes repeat multisets: 4+ over two cells → {1,3} and {2,2}', () => {
    expect(normalize(kenkenCombosFor('add', 2, 4, 6))).toEqual(['1,3', '2,2']);
  });

  it('enumerates a three-cell sum with repeats (6+ on 6×6)', () => {
    // {1,1,4}, {1,2,3}, {2,2,2} — multiset partitions of 6 into 3 parts, each ≤ 6.
    expect(normalize(kenkenCombosFor('add', 3, 6, 6))).toEqual(['1,1,4', '1,2,3', '2,2,2']);
  });

  it('respects the max digit (no part may exceed N)', () => {
    // 11+ over two cells on 6×6 → {5,6} only ({4,7}/{3,8}… exceed 6).
    expect(normalize(kenkenCombosFor('add', 2, 11, 6))).toEqual(['5,6']);
  });

  it('single-cell add is a given: [[target]] when target ≤ N, else empty', () => {
    expect(kenkenCombosFor('add', 1, 5, 6)).toEqual([[5]]);
    expect(kenkenCombosFor('add', 1, 7, 6)).toEqual([]);
  });
});

describe('kenkenCombosFor — multiplication', () => {
  it('the canonical 6× four-cell case → {1,1,1,6} and {1,1,2,3}', () => {
    expect(normalize(kenkenCombosFor('mul', 4, 6, 6))).toEqual(['1,1,1,6', '1,1,2,3']);
  });

  it('12× over two cells on 4×4 → {3,4} only', () => {
    expect(normalize(kenkenCombosFor('mul', 2, 12, 4))).toEqual(['3,4']);
  });

  it('a large product factors into few sets (60× three-cell on 5×5 → {3,4,5})', () => {
    expect(normalize(kenkenCombosFor('mul', 3, 60, 5))).toEqual(['3,4,5']);
  });
});

describe('kenkenCombosFor — subtraction (two-cell only)', () => {
  it('3− on 4×4 → {1,4} only', () => {
    expect(normalize(kenkenCombosFor('sub', 2, 3, 4))).toEqual(['1,4']);
  });

  it('1− on 4×4 → {1,2},{2,3},{3,4}', () => {
    expect(normalize(kenkenCombosFor('sub', 2, 1, 4))).toEqual(['1,2', '2,3', '3,4']);
  });

  it('is empty for any cage size other than 2 (by construction)', () => {
    expect(kenkenCombosFor('sub', 3, 2, 6)).toEqual([]);
    expect(kenkenCombosFor('sub', 1, 2, 6)).toEqual([]);
  });
});

describe('kenkenCombosFor — division (two-cell only)', () => {
  it('3÷ on 4×4 → {1,3} only', () => {
    expect(normalize(kenkenCombosFor('div', 2, 3, 4))).toEqual(['1,3']);
  });

  it('2÷ on 6×6 → {1,2},{2,4},{3,6}', () => {
    expect(normalize(kenkenCombosFor('div', 2, 2, 6))).toEqual(['1,2', '2,4', '3,6']);
  });

  it('1÷ is empty — a two-cell cage is always collinear, so it can never hold the repeat', () => {
    expect(kenkenCombosFor('div', 2, 1, 6)).toEqual([]);
  });

  it('is empty for any cage size other than 2', () => {
    expect(kenkenCombosFor('div', 3, 2, 6)).toEqual([]);
  });
});

describe('kenken masks (priors)', () => {
  it('union is the digits in ANY multiset; guaranteed is those in EVERY one', () => {
    // 6× four-cell: {1,1,1,6} ∪ {1,1,2,3} = {1,2,3,6}; ∩ = {1}.
    expect(kenkenUnionMask('mul', 4, 6, 6)).toBe(maskOf(1, 2, 3, 6));
    expect(kenkenGuaranteedMask('mul', 4, 6, 6)).toBe(maskOf(1));
  });

  it('a single-combination cage guarantees both of its digits (3− on 4×4 → {1,4})', () => {
    expect(kenkenGuaranteedMask('sub', 2, 3, 4)).toBe(maskOf(1, 4));
  });

  it('an impossible clue has empty masks', () => {
    expect(kenkenUnionMask('add', 2, 100, 6)).toBe(0);
    expect(kenkenGuaranteedMask('add', 2, 100, 6)).toBe(0);
  });
});

describe('memoization', () => {
  it('returns identical (cached) results across calls, and rebuilds after a clear', () => {
    const first = kenkenCombosFor('mul', 4, 6, 6);
    const second = kenkenCombosFor('mul', 4, 6, 6);
    expect(second).toBe(first); // same frozen reference — served from the memo
    _clearKenKenComboMemo();
    const rebuilt = kenkenCombosFor('mul', 4, 6, 6);
    expect(normalize(rebuilt)).toEqual(normalize(first)); // same content, fresh reference
  });

  it('the shared result is frozen (defends against caller mutation)', () => {
    const combos = kenkenCombosFor('add', 2, 4, 6);
    expect(Object.isFrozen(combos)).toBe(true);
    expect(Object.isFrozen(combos[0])).toBe(true);
  });
});
