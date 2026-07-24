# Keisan Exact Solver (`calc-solver.ts`)

The bitmask/MRV backtracking solver for Keisan (Calcudoku). Two jobs: **solve** a puzzle (find one
solution) and **count solutions** (capped at 2) so the generator can gate on uniqueness. Per
AGENTS.md §1 this is bitmask/MRV, not DLX.

## Latin square, no boxes

Keisan is a Latin square — 1..N once per row and column, **no box constraint**. So the solver
keeps only `rowMask` and `colMask` (no `boxMask`, unlike the classic/Killer solvers). Candidate
digits for an empty cell start from `full & ~(rowMask[r] | colMask[c])`.

## Why the geometry (repeat) layer is free

K1 splits cage validity into two layers: arithmetic (does a multiset hit the target) and geometric
(can the repeats actually be placed — same-row/col repeats are illegal). **The geometric layer is
already the Latin-square rule.** Two cage cells in the same row can't hold the same digit because
the row mask forbids it. So the solver enforces geometry for free through `rowMask`/`colMask`; the
cage layer only has to enforce the arithmetic.

## Cage-candidate pruning (mandatory)

Each cage precompiles its valid multisets (from `calc-combinations`) into per-digit **count
arrays**. During search it tracks `cagePlaced[cage]` (the multiset of digits already placed) and a
derived `cageMask[cage]`:

```text
cageMask(cage) = OR over every valid multiset m that has cagePlaced as a SUB-multiset,
                 of the digits m still needs: { d : count_m(d) > count_placed(d) }
```

A cell's candidates are `rowColFree & cageMask[cage]`. Because a placement is only admitted when it
keeps the placed multiset a sub-multiset of some valid one, a fully-filled cage necessarily equals a
valid multiset — **no separate end-of-cage arithmetic check is needed**. `cageMask` is recomputed on
every `place`/`unplace` (cages are small, so this is cheap).

This pruning is **mandatory, not optional**: a boxless grid has 2 constraining units per cell
instead of 3, so single/naked cascades fire less and the search would balloon without it. Measured:
6×6 QuadOp uniqueness-verify runs **~0.04 ms avg** (gate < 50 ms).

## Node budget

`countSolutions(limit = 2, nodeBudget = ∞)` bounds worst-case cost. On budget exhaustion it returns
**-1** ("could not verify in budget"), so a generator checking `=== 1` safely rejects rather than
risk a false "unique". `0` = unsolvable, `1` = unique, `≥ 2` = ambiguous.

```text
countSolutions(limit, nodeBudget):
  reset search state; nodesLeft = nodeBudget
  search(limit):
    consume a node; if over budget → mark exhausted, return
    MRV-scan empty cells for the fewest candidates (rowColFree & cageMask); break early on a forced/dead cell
    no empty cell → a full solution: count++, snapshot the first
    dead cell (0 candidates) → backtrack
    else for each candidate digit: place, recurse, unplace; stop at limit or budget exhaustion
  return exhausted ? -1 : count
```
