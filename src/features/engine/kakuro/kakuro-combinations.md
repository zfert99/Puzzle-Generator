# Kakuro Combinations (`kakuro-combinations.ts`)

For a run of `length` cells summing to `sum`, which sets of distinct digits 1–9 are possible?

## Why this is a view over the Killer table, not a second table

A Kakuro run is a Killer cage with the house constraint removed: distinct digits 1–9 with a
fixed sum. That is exactly the question `killer/cage-combinations.ts` precomputes for
`maxDigit = 9`, so this module re-exports it under Kakuro names rather than building a second
copy that could drift. The table is tiny and fixed — the 511 non-empty subsets of {1..9},
grouped by length as 9 / 36 / 84 / 126 / 126 / 84 / 36 / 9 / 1 — and the tests here pin those
counts and the canonical "magic" entries (3-in-two = {1,2}, 17-in-two = {8,9}, 45-in-nine) so
the Killer table cannot change shape underneath Kakuro unnoticed.

## Why masks

The solver filters a run's combinations against its cells' candidate masks at every
propagation step. A combination as a bitmask (bit `d − 1` is digit `d`, the engine-wide
convention) tests "does this cell allow any digit of this combination?" with one AND; a digit
list would need a loop. `runComboMasks(length, sum)` converts the digit lists once and memoizes
the frozen array.

```text
runCombos(L, S)          the digit lists (ascending), empty if impossible
runComboMasks(L, S)      the same as bitmasks, memoized
runCandidateMask(L, S)   OR of all combinations — a digit no combination uses can go nowhere
runGuaranteedMask(L, S)  AND of all combinations — a digit every combination needs
isUniqueCombination      exactly one combination: the easiest deduction in the game
```
