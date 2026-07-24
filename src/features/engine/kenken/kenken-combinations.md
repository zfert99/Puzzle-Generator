# KenKen Cage-Combination Tables (`kenken-combinations.ts`)

The arithmetic core of KenKen. Answers the one question every KenKen deduction depends on: for a
cage of `size` cells with operator `op` and target `target` on an N×N grid, which **multisets** of
digits produce the target?

## Multisets, not sets (the #1 porting bug)

KenKen permits a digit to repeat within a cage (as long as the repeats don't share a row/column),
so cage contents are **multisets** — `[1, 1, 2, 3]` is legal — not the distinct-digit sets Killer
uses. A naive port that reuses Killer's set-based tables silently rejects valid solutions or
accepts invalid ones. This is why K1 is its own gated slice; the tables here are multiset-based
from the ground up.

## The two-layer check (do not skip)

This module is **layer one: arithmetic validity** only. It does NOT know cage geometry, so it
cannot tell whether a repeat is actually *placeable*. **Layer two: geometric placement legality**
lives in the solver (K2): a straight domino/line cage (all cells collinear) can hold NO repeats;
only L/T/blocky cages spanning 2+ rows and columns can.

The tables deliberately **over-approximate** — they list every arithmetically-valid multiset, and
the solver prunes the geometrically-impossible ones at placement time. This makes the masks
**priors**, never exact for a specific cage shape:

| Mask | Direction | Meaning | Safe because |
|---|---|---|---|
| `kenkenUnionMask` | **upper** bound | digits in ANY valid multiset | geometry only removes multisets, so the true usable-digit set is a subset — never wrongly *excludes* a digit (safe for candidate pruning), but over-counts for line cages |
| `kenkenGuaranteedMask` | **lower** bound | digits in EVERY valid multiset | removing multisets can only make a digit *more* guaranteed — a digit guaranteed over all stays guaranteed over the valid subset (safe to eliminate on) |

**Never treat a mask as exact for a given cage.** A future optimization that trusts the union mask
as the precise candidate set for a line-shaped cage would be wrong.

## Per-operator enumeration

Each is a pruned **non-decreasing** walk, so every multiset is produced exactly once; the next
digit starts at `d` (not `d+1`) to allow repeats.

- **add** — multisets summing to target. Prune when `d * count > remaining` (all remaining digits
  are ≥ `d`, so even the minimum overshoots — and only grows).
- **mul** — multisets whose product is target. Only divisors of the remaining product are tried;
  prune when `d^count > remaining`. `1` always divides and never overshoots, so runs of 1s (e.g.
  `{1,1,2,3}` for `6×`) enumerate correctly.
- **sub** (two cells) — pairs `[lo, hi]` with `hi − lo === target`. `target ≥ 1` forces distinct
  digits, which is required anyway (two-cell cages are always collinear → no repeats).
- **div** (two cells) — pairs `[lo, hi]` with `hi === lo × target`. Equal pairs are skipped, so
  `1÷` returns empty — a two-cell cage can never hold the `{k, k}` repeat it would require.

`sub`/`div` return empty for any size other than 2 (the two-cell restriction, by construction).
Single-cell `add`/`mul` naturally yield `[[target]]` when `target ≤ N` — exactly a given.

## Memoization & budget

Lazily memoized in a `Map` keyed by `(N, op, size, target)`, computed on first request:

- **Why lazy, not eager** (unlike Killer's precomputed table): `add`/`sub`/`div` target ranges are
  tiny, but `mul` targets are **sparse over a huge range** — up to `N^size` (9^6 = 531 441; a
  full-line product can reach 9! = 362 880). A dense eager array would be almost entirely empty.
- **Integer safety:** every product stays far inside JS's safe-integer range (2^53), so no
  overflow handling is needed.
- **Cost:** enumeration is bounded by cage size (the generator caps cages small), so first-touch is
  negligible and every later read is a `Map` hit. `_clearKenKenComboMemo()` is a test hook.

## Worked examples (the K1 gate)

```text
kenkenCombosFor('mul', 4, 6, 6) → [[1,1,1,6],[1,1,2,3]]   the classic 6× four-cell case
kenkenCombosFor('add', 2, 4, 6) → [[1,3],[2,2]]           note the {2,2} repeat multiset
kenkenCombosFor('sub', 2, 3, 4) → [[1,4]]                 3− on 4×4
kenkenCombosFor('div', 2, 3, 4) → [[1,3]]                 3÷ on 4×4
kenkenCombosFor('div', 2, 1, 6) → []                      1÷ impossible (collinear two-cell)
kenkenGuaranteedMask('mul', 4, 6, 6) → {1}               both 6× multisets contain a 1
```
