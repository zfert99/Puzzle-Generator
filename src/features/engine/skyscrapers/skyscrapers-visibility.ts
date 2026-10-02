/**
 * The per-size permutation table the Skyscrapers solvers run on (plan slice E1).
 *
 * A Skyscrapers line is a permutation of 1..N, and a clue pair (left, right) admits only the
 * permutations whose visibility counts match. There are N! of them — 120 at 5×5, 720 at 6×6,
 * 5,040 at 7×7, 362,880 at 9×9 — so the table is built once per size, lazily, and cached: every
 * permutation's heights, its visibility from each end, and for every clue pair (blank = any) the
 * list of permutations it admits. Tatham's `towers.c` enumerates this on every call and warns it
 * is too slow at 9×9; precomputing turns that bottleneck into an array lookup (research §4).
 * See `skyscrapers-visibility.md`.
 */

import { visibleCount } from './skyscrapers-types';

export interface PermutationTable {
  size: number;
  /** N! */
  count: number;
  /** Heights of permutation `p` at `heights[p * size + i]`, 1..N, in reading order. */
  heights: Uint8Array;
  /** Visibility of permutation `p` read from its first element (the left / top clue). */
  visLeft: Uint8Array;
  /** Visibility of permutation `p` read from its last element (the right / bottom clue). */
  visRight: Uint8Array;
  /**
   * Permutation indices admitted by each clue pair, at `buckets[left * (size + 1) + right]`;
   * a clue of 0 means "blank — any count". `buckets[0]` is every permutation.
   */
  buckets: Int32Array[];
}

const CACHE = new Map<number, PermutationTable>();

/** The index of the bucket for a clue pair (0 = blank on that side). */
export function bucketIndex(size: number, left: number, right: number): number {
  return left * (size + 1) + right;
}

/**
 * Build (or fetch) the table for size N. Lexicographic order, so permutation 0 is 1,2,…,N
 * (visible N from the left, 1 from the right).
 */
export function permutationTable(size: number): PermutationTable {
  const cached = CACHE.get(size);
  if (cached) return cached;

  let count = 1;
  for (let k = 2; k <= size; k++) count *= k;
  const heights = new Uint8Array(count * size);
  const visLeft = new Uint8Array(count);
  const visRight = new Uint8Array(count);

  // Enumerate in lexicographic order with a small recursive builder; N ≤ 9 keeps this trivial.
  const current = new Array<number>(size).fill(0);
  let used = 0;
  let index = 0;
  const line: number[] = new Array<number>(size);
  const build = (position: number) => {
    if (position === size) {
      for (let i = 0; i < size; i++) {
        line[i] = current[i];
        heights[index * size + i] = current[i];
      }
      visLeft[index] = visibleCount(line);
      visRight[index] = visibleCount(line.slice().reverse());
      index++;
      return;
    }
    for (let h = 1; h <= size; h++) {
      const bit = 1 << h;
      if (used & bit) continue;
      used |= bit;
      current[position] = h;
      build(position + 1);
      used &= ~bit;
    }
  };
  build(0);

  // Bucket counts first, then fill — one pass each, no growable arrays.
  const pairs = (size + 1) * (size + 1);
  const sizes = new Int32Array(pairs);
  const pairsOf = (p: number): [number, number, number, number] => {
    const l = visLeft[p];
    const r = visRight[p];
    return [bucketIndex(size, l, r), bucketIndex(size, l, 0), bucketIndex(size, 0, r), bucketIndex(size, 0, 0)];
  };
  for (let p = 0; p < count; p++) for (const b of pairsOf(p)) sizes[b]++;
  const buckets: Int32Array[] = Array.from({ length: pairs }, (_, b) => new Int32Array(sizes[b]));
  const fill = new Int32Array(pairs);
  for (let p = 0; p < count; p++) for (const b of pairsOf(p)) buckets[b][fill[b]++] = p;

  const table: PermutationTable = { size, count, heights, visLeft, visRight, buckets };
  CACHE.set(size, table);
  return table;
}
