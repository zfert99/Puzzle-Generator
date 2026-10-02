import { describe, expect, it } from 'vitest';
import { bucketIndex, permutationTable } from './skyscrapers-visibility';
import { visibleCount } from './skyscrapers-types';

describe('permutationTable', () => {
  it('holds N! permutations, each a permutation of 1..N, in lexicographic order', () => {
    const table = permutationTable(4);
    expect(table.count).toBe(24);
    expect(Array.from(table.heights.subarray(0, 4))).toEqual([1, 2, 3, 4]);
    expect(Array.from(table.heights.subarray(23 * 4, 24 * 4))).toEqual([4, 3, 2, 1]);
    for (let p = 0; p < table.count; p++) {
      const line = Array.from(table.heights.subarray(p * 4, p * 4 + 4));
      expect([...line].sort()).toEqual([1, 2, 3, 4]);
    }
    expect(permutationTable(5).count).toBe(120);
    expect(permutationTable(7).count).toBe(5040);
  });

  it('records each permutation\'s visibility from both ends, matching visibleCount', () => {
    const table = permutationTable(5);
    for (let p = 0; p < table.count; p++) {
      const line = Array.from(table.heights.subarray(p * 5, p * 5 + 5));
      expect(table.visLeft[p]).toBe(visibleCount(line));
      expect(table.visRight[p]).toBe(visibleCount([...line].reverse()));
    }
    expect(table.visLeft[0]).toBe(5); // 1,2,3,4,5
    expect(table.visRight[0]).toBe(1);
  });

  it('buckets every clue pair, with 0 as "blank"', () => {
    const table = permutationTable(4);
    const bucket = (l: number, r: number) => Array.from(table.buckets[bucketIndex(4, l, r)]);

    expect(bucket(0, 0)).toHaveLength(24);
    expect(bucket(4, 1)).toEqual([0]); // only 1,2,3,4 shows four from the left and one from the right
    expect(bucket(1, 0)).toHaveLength(6); // 4 first, the rest in any order
    expect(bucket(0, 4)).toEqual([23]); // 4,3,2,1 read from the right is ascending
    for (const p of bucket(2, 2)) {
      expect(table.visLeft[p]).toBe(2);
      expect(table.visRight[p]).toBe(2);
    }
    // Facing clues summing to more than N+1 admit nothing.
    expect(bucket(4, 2)).toHaveLength(0);
    expect(bucket(3, 3)).toHaveLength(0);
  });

  it('is cached per size', () => {
    expect(permutationTable(6)).toBe(permutationTable(6));
  });
});
