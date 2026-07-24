/**
 * Cage-combination enumeration — the arithmetic core of Calcudoku.
 *
 * A Calcudoku cage of `size` cells, operator `op`, and target `target` on an N×N grid can hold any
 * **multiset** of `size` digits from 1..N that produces `target` under `op`. Multisets — NOT
 * distinct-digit sets like Killer — because Calcudoku permits a digit to repeat within a cage (as
 * long as the repeats don't share a row/column). This is the single most common source of solver
 * bugs when porting from Killer, and the reason this is its own gated slice (K1).
 *
 * ## Two-layer check (READ THIS before trusting a mask)
 *
 * This module answers **arithmetic** validity only: which multisets hit the target. It does NOT
 * know cage geometry, so it cannot say whether a repeat is *placeable*. A straight domino/line
 * cage (all cells share a row or a column) can hold NO repeats at all; only L/T/blocky cages that
 * span 2+ rows and columns can. Geometric placement legality is a separate second layer enforced
 * at the SOLVER's placement check (K2). Consequences for the masks below:
 *
 * - `calcUnionMask` **over-approximates** (upper bound): geometry only ever *removes* multisets,
 *   so the true set of usable digits is a subset. Safe for candidate pruning — it never wrongly
 *   excludes a digit — but for a line-shaped cage it over-counts (includes digits reachable only
 *   through repeat-only multisets that geometry forbids).
 * - `calcGuaranteedMask` **under-approximates** (lower bound): removing multisets can only make
 *   a digit *more* guaranteed, never less, so a digit guaranteed over ALL multisets stays
 *   guaranteed over the geometrically-valid subset. Safe for elimination.
 *
 * Never treat either mask as exact for a specific cage shape — they are priors.
 *
 * ## Memoization / budget
 *
 * Keyed by `(N, op, size, target)` and computed lazily on first request (per-N lazy build, not an
 * eager table): addition/subtraction/division target ranges are tiny, but multiplication targets
 * are sparse over a huge range (up to N^size — e.g. 9^6 = 531 441, and 9! = 362 880 for a
 * full-line product), so a dense eager table would be mostly empty. All products stay far inside
 * JS's safe-integer range (2^53), so no overflow handling is needed. Enumeration is a pruned
 * non-decreasing walk (bounded by cage size, which the generator caps small), so first-touch cost
 * is negligible and every later read is a `Map` hit.
 *
 * See `calc-combinations.md` for the "why".
 */

import type { CalcOperator } from './calc-types';

/** An ascending MULTISET of digits, e.g. `[1, 1, 2, 3]` (repeats allowed). Frozen — never mutate. */
export type Multiset = readonly number[];

interface ComboEntry {
  combos: readonly Multiset[];
  /** Digits appearing in ANY multiset (bit d-1). Over-approximating prior — see the two-layer note. */
  unionMask: number;
  /** Digits appearing in EVERY multiset. Under-approximating prior — safe to eliminate on. */
  guaranteedMask: number;
}

/** Bitmask of the DISTINCT digits in a multiset (bit `d-1` per distinct digit `d`). */
function bitsOf(multiset: Multiset): number {
  let mask = 0;
  for (const digit of multiset) mask |= 1 << (digit - 1);
  return mask;
}

/** Recursively freeze an array and everything inside it so a shared cached entry can't be mutated. */
function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

/**
 * Addition: every non-decreasing multiset of `size` digits from 1..N summing to `target`.
 * Non-decreasing order yields each multiset exactly once; the next digit starts at `d` (not
 * `d + 1`) so repeats are allowed. Prune: with `count` digits left, each ≥ the current `d`, the
 * smallest reachable remainder is `d * count` — once that overshoots, every larger `d` does too.
 */
function enumerateAdd(size: number, target: number, maxDigit: number): number[][] {
  const results: number[][] = [];
  const current: number[] = [];
  const walk = (start: number, count: number, remaining: number): void => {
    if (count === 0) {
      if (remaining === 0) results.push([...current]);
      return;
    }
    for (let digit = start; digit <= maxDigit; digit++) {
      if (digit * count > remaining) break; // even all-minimum overshoots — and only grows
      current.push(digit);
      walk(digit, count - 1, remaining - digit);
      current.pop();
    }
  };
  walk(1, size, target);
  return results;
}

/**
 * Multiplication: every non-decreasing multiset of `size` digits from 1..N whose product is
 * `target`. Only divisors of the remaining product are tried; prune when `d^count` (all remaining
 * digits ≥ d) exceeds the remaining product. `1` always divides and never overshoots, so runs of
 * 1s (e.g. `{1,1,2,3}` for `6×`) are enumerated correctly.
 */
function enumerateMul(size: number, target: number, maxDigit: number): number[][] {
  const results: number[][] = [];
  const current: number[] = [];
  const walk = (start: number, count: number, remaining: number): void => {
    if (count === 0) {
      if (remaining === 1) results.push([...current]);
      return;
    }
    for (let digit = start; digit <= maxDigit; digit++) {
      if (remaining % digit !== 0) continue;
      if (digit ** count > remaining) break; // even all-minimum overshoots — and only grows
      current.push(digit);
      walk(digit, count - 1, remaining / digit);
      current.pop();
    }
  };
  walk(1, size, target);
  return results;
}

/**
 * Subtraction (two cells only): pairs `[lo, hi]` with `hi - lo === target`, both ≤ N. `target ≥ 1`
 * forces `hi > lo`, so the pair is always distinct — which is required anyway: a two-cell cage's
 * cells are orthogonally adjacent, hence always collinear, so they could never legally hold a
 * repeat.
 */
function enumerateSub(target: number, maxDigit: number): number[][] {
  if (target < 1) return [];
  const results: number[][] = [];
  for (let lo = 1; lo + target <= maxDigit; lo++) results.push([lo, lo + target]);
  return results;
}

/**
 * Division (two cells only): pairs `[lo, hi]` with `hi === lo * target`, both ≤ N. Equal pairs are
 * skipped: `target === 1` would give `hi === lo`, but a two-cell cage is always collinear and thus
 * can never hold a repeat, so a `1÷` cage has no legal filling — the enumerator returns empty,
 * matching reality rather than emitting geometrically-dead pairs.
 */
function enumerateDiv(target: number, maxDigit: number): number[][] {
  if (target < 1) return [];
  const results: number[][] = [];
  for (let lo = 1; lo * target <= maxDigit; lo++) {
    const hi = lo * target;
    if (hi !== lo) results.push([lo, hi]);
  }
  return results;
}

/**
 * Enumerate the raw multisets for `(op, size, target, N)`, enforcing the two-cell restriction on
 * `sub`/`div` by construction (any other size returns empty). Single-cell `add`/`mul` naturally
 * yield `[[target]]` when `target ≤ N`, which is exactly a given.
 */
function enumerate(op: CalcOperator, size: number, target: number, maxDigit: number): number[][] {
  switch (op) {
    case 'add':
      return enumerateAdd(size, target, maxDigit);
    case 'mul':
      return enumerateMul(size, target, maxDigit);
    case 'sub':
      return size === 2 ? enumerateSub(target, maxDigit) : [];
    case 'div':
      return size === 2 ? enumerateDiv(target, maxDigit) : [];
  }
}

/** Lazy memo keyed by `${N}:${op}:${size}:${target}` → frozen entry. */
const MEMO = new Map<string, ComboEntry>();
const EMPTY_ENTRY: ComboEntry = Object.freeze({
  combos: deepFreeze([] as number[][]),
  unionMask: 0,
  guaranteedMask: 0,
});

function entryFor(op: CalcOperator, size: number, target: number, maxDigit: number): ComboEntry {
  if (size < 1 || size > maxDigit * maxDigit || target < 0 || maxDigit < 1) return EMPTY_ENTRY;
  const key = `${maxDigit}:${op}:${size}:${target}`;
  const cached = MEMO.get(key);
  if (cached) return cached;

  const combos = enumerate(op, size, target, maxDigit);
  let unionMask = 0;
  let guaranteedMask = combos.length > 0 ? (1 << maxDigit) - 1 : 0;
  for (const combo of combos) {
    const bits = bitsOf(combo);
    unionMask |= bits;
    guaranteedMask &= bits;
  }
  // deepFreeze handles the arrays (combos + each multiset); Object.freeze locks the entry itself,
  // so a caller can never mutate a shared cached result.
  const entry: ComboEntry = Object.freeze({ combos: deepFreeze(combos), unionMask, guaranteedMask });
  MEMO.set(key, entry);
  return entry;
}

/**
 * Every multiset of `size` digits from 1..`maxDigit` that produces `target` under `op` (a memoized
 * lookup). Each multiset is ascending; `sub`/`div` are two-cell-only (empty for any other size).
 * The result is FROZEN and shared — never mutate it (copy first, e.g. `[...combo]`).
 *
 * REMEMBER: these are arithmetically valid but NOT geometry-checked. A line-shaped cage cannot
 * hold the repeat-bearing entries — the solver enforces that (see the two-layer note at the top).
 *
 * @example
 * calcCombosFor('mul', 4, 6, 6)  // [[1,1,1,6],[1,1,2,3]]  — the classic `6×` 4-cell case
 * calcCombosFor('sub', 2, 3, 4)  // [[1,4]]                 — `3−` on 4×4
 * calcCombosFor('div', 2, 3, 4)  // [[1,3]]                 — `3÷` on 4×4
 */
export function calcCombosFor(
  op: CalcOperator,
  size: number,
  target: number,
  maxDigit: number,
): readonly Multiset[] {
  return entryFor(op, size, target, maxDigit).combos;
}

/**
 * Digits that appear in ANY valid multiset for `(op, size, target, N)`, packed as a bitmask
 * (bit `d-1` set iff digit `d` is possible somewhere). An **over-approximating prior**: geometry
 * can only shrink the true set, so this never wrongly excludes a digit but over-counts for
 * line-shaped cages. `0` means the clue is impossible.
 */
export function calcUnionMask(
  op: CalcOperator,
  size: number,
  target: number,
  maxDigit: number,
): number {
  return entryFor(op, size, target, maxDigit).unionMask;
}

/**
 * Digits that appear in EVERY valid multiset for `(op, size, target, N)`, packed as a bitmask —
 * digits *guaranteed* to sit somewhere in the cage. An **under-approximating prior**: safe to
 * eliminate a guaranteed digit from the cage's peers. `0` means nothing is forced.
 *
 * @example
 * calcGuaranteedMask('mul', 4, 6, 6)  // {1}  — both {1,1,1,6} and {1,1,2,3} contain a 1
 */
export function calcGuaranteedMask(
  op: CalcOperator,
  size: number,
  target: number,
  maxDigit: number,
): number {
  return entryFor(op, size, target, maxDigit).guaranteedMask;
}

/** Test/diagnostic hook: clear the memo so a test can measure cold-build behaviour. */
export function _clearCalcComboMemo(): void {
  MEMO.clear();
}
