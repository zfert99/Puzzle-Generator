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
a small bipartite feasibility check) is therefore a **measured optimization**. Adding it
speculatively would complicate the hot loop for an unmeasured payoff (AGENTS.md §3).

## What the K3 measurement showed

Profiling the solver over real cage layouts (K3's generator) gave a clear cliff:

| Max cage size | Verify time (countSolutions, 9×9) |
|---|---|
| ≤ 4 | < 10 ms worst case (avg well under 1 ms) |
| 5 | usually fast, but **occasionally seconds** |

So the under-pruning has a real cost, but only for large *loose* cages. The generator's default
`maxSize` is therefore **4**, which keeps every verification comfortably under the 50 ms budget.
Reaching for maxSize 5 (or hardest-possible puzzles) is what would justify implementing the
tighter cage pruning, or giving the K5 pipeline a per-verify time/node budget that rejects a
layout the solver can't dispatch quickly. Both are deferred until a feature actually needs
size-5 cages.

## Not yet here

- **Tighter cage pruning / a verify budget** — only if size-5 (or extreme) puzzles are wanted.
- **Logical (grading) mode** — a separate concern (K4); this file is exact-search only.

## E1: pruning + node budget (July 2026)

Two changes from the expert-tier work (`Docs/killer-expert-implementation-plan.md`, slice E1),
both benchmark-driven on fixed layout fixtures:

- **Combo-filtered candidates (P1).** `candidates()` now uses `candidateMaskExcluding` — only
  digits from combinations disjoint from the cage's used digits. Baseline → P1 on maxSize-4
  hard-shaped layouts: 191 ms → 155 ms avg verify (median 64 → 33 ms); the pathological
  3-cell-biased class fell 33 s → 2.6 s avg; the existing hard path got faster (14 → 11 ms).
- **Node budget (P3).** `countSolutions(limit, nodeBudget)` returns **−1** when the search
  exhausts the budget — callers checking `=== 1` reject, so exhaustion can cost yield but
  never correctness. At a 100 k-node budget, maxSize-4 verifies run **33.6 ms avg / 94 ms
  max** (E1 gate: ≤ 50 ms avg ✓) and unique-layouts-per-second triples versus unbounded
  (bounded rejects beat unbounded tails). `nodesUsed` exposes the per-run node count for
  budget tuning. `solve()` is never budget-limited.

**A 45-rule house-sum bound (P2) was tried and REMOVED**: on identical fixtures it was a pure
25–30 % slowdown across every class — MRV plus the P1 cage masks already catch nearly
everything the house bound would, and its per-placement min/max loops cost more than the rare
extra prunes saved. Don't re-add it without a fixture A/B.
