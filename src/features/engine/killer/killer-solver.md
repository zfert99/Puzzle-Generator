# Killer Solver (`killer-solver.ts`)

The exact solver — it finds a Killer puzzle's solution and, crucially, **counts** solutions
(stopping at the 2nd) so the generator can verify a cage layout is uniquely solvable. That
uniqueness gate is the whole reason the exact solver exists.

## Why bitmask backtracking, not DLX

AGENTS.md §1 forbids preferring DLX/exact-cover for this engine, so this is the same
bitmask + MRV backtracking the classic generator uses, extended with cage constraints. It
keeps the engine pure TypeScript with no native/WASM dependency, and hits the perf budget for
9×9 (see the Killer plan §2 for the full reconciliation with the research's DLX default).

## The candidate formula — where K1 pays off

Each empty cell's legal digits are one bitmask, built by intersecting four things:

```text
candidates =  full
           &  ~(row used | col used | box used)      classic Sudoku
           &  ~(digits already used in the cage)      cage no-repeat
           &  candidateMaskFor(cageCellsLeft, sumLeft) cage arithmetic (K1 table)
```

The last line does a surprising amount of work for free:

- It prunes digits that can't appear in the cage's remaining (cells, sum).
- It **forces the final cell**: a 1-cell remainder of sum S → `candidateMaskFor(1, S)` is the
  single digit S. So there is **no separate "does the cage add up?" check anywhere** — the sum
  is enforced incrementally, one `&` per placement. Place/unplace keep `cageRemSum` and
  `cageRemCells` in step.

## MRV + solution counting

The search fills the empty cell with the **fewest** candidates next (minimum remaining values),
and abandons a branch the instant any empty cell has zero candidates — dead ends surface early,
which matters because Killer has no givens to seed from. `countSolutions(limit=2)` stops the
moment a second solution appears, so the uniqueness check is cheap: `1` = unique (what the
generator keeps), `0` = impossible, `≥2` = ambiguous (rejected).

## The "intersection" nuance (correctness vs. pruning strength)

`candidateMaskFor(cellsLeft, sumLeft)` is *arithmetic only* — it ignores that the cage's other
remaining cells have already been narrowed by their own rows/cols/boxes. So for a cage spanning
multiple houses it can **under-prune**: it may keep a digit that some combination needs but that
combination's partner can't actually be placed.

This was flagged in review as a trap — and the key point is that it's a trap for pruning
*strength*, **not correctness**. This solver never treats the arithmetic mask as a sufficient
answer; it *places a digit and recurses*, and a doomed combination simply fails deeper in the
search and backtracks. The result is always correct (the two-box-cage test pins this down);
the only cost of under-pruning is a bit more search.

Tighter pruning (intersecting each combination against the remaining cells' candidate masks —
a small bipartite feasibility check) is therefore a **measured optimization**, deferred until
the K5 generator benchmarks show a real uniqueness check exceeding the < 50 ms budget. Adding it
speculatively would complicate the hot loop for a payoff we haven't measured (AGENTS.md §3).

## Not yet here

- **Performance validation** against real (K3-generated) cage layouts — the < 50 ms target is
  meaningful only once we have genuine unique Killers to verify, which arrive with the cage
  generator.
- **Logical (grading) mode** — a separate concern (K4); this file is exact-search only.
