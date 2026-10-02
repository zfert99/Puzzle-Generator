# Skyscrapers Visibility Table (`skyscrapers-visibility.ts`)

The per-size permutation table every Skyscrapers solver runs on (plan slice E1 in
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)).

## Why a table, and why per size

A Skyscrapers line is a permutation of 1..N, and a clue pair admits exactly the permutations
whose visibility counts match. The research found every fast solver converging on this one
primitive — and found Tatham's `towers.c` enumerating the permutations on *every* call, which is
why it warns that 9×9 is too slow. Enumerating once per size (N! = 120 at 5, 720 at 6, 5,040 at
7, 362,880 at 9) and caching turns that bottleneck into an array lookup. The table is built
**lazily**: a session that never opens a 9×9 never pays its ~4 MB.

## What it holds

```text
permutationTable(N):
    heights  — N! × N bytes, permutation p's heights in reading order (lexicographic: p = 0 is 1..N)
    visLeft  — visibility of p read from its first element   (the left / top clue)
    visRight — visibility of p read from its last element    (the right / bottom clue)
    buckets  — for every clue pair (l, r) with 0 meaning "blank, any count":
               the permutation indices it admits, at buckets[l × (N+1) + r]
```

Each permutation lands in four buckets — (l, r), (l, 0), (0, r), (0, 0) — so a line with one
blank clue costs one lookup, not a union, and a line with two blanks reads the full list. The
buckets are sized in one counting pass and filled in a second, so there are no growable arrays.
Facing clues whose sum exceeds N+1 simply have an empty bucket: the solver reports a
contradiction for such a line before any search.

## `bucketIndex(size, left, right)`

The flat index of a clue pair's bucket; exported so the solver and its tests address the table
the same way.
